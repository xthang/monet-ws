import type { WebSocketServer, WebSocket } from 'ws'

import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsHttpCode } from '@/types/error'
import type { Ws_Message_Text_Send_RequestData } from '@/types/ws/request'
import type { Ws_Message_Send_Receipt, WsResponseFullPayload } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../db/queries'
import { MESSAGE_SELECT } from '../../db/query-constants'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export default async function handleNewMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  message: Ws_Message_Text_Send_RequestData
) {
  const { accountId, orgId } = ws.auth
  const { groupId, tabId, uiId, text, sentAt } = message

  try {
    // validate inputs
    // check if the diff between sent time & current server time is too large
    const timeDiff = Math.abs(sentAt.getTime() - Date.now())
    if (timeDiff > 5 * 60 * 10e3) {
      throw new WsError(
        WsHttpCode.BAD_REQUEST,
        null,
        `the diff between sent time (${sentAt}) & current server time (${new Date()}) is too large (${timeDiff})`
      )
    }

    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    return await db.$transaction(async (tx) => {
      const createdMsg = await tx.message.create({
        data: { uiId, groupId, tabId, text, sentAt, sentBy: accountId, createdBy: accountId },
        select: MESSAGE_SELECT
      })
      const { uiId: createdUiId, ...createdMsgWithoutUiId } = createdMsg

      await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      const _updatedConvo = await tx.group.update({
        where: { id: groupId },
        data: { lastMessageId: createdMsg.id, lastMessageAt: new Date(), lastActiveAccounts }
      })

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'message--text--new',
        orgId,
        data: createdMsgWithoutUiId
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          tab_id: tabId,
          ui_id: createdUiId!,
          message: createdMsg as RequiredNonNullableProps<typeof createdMsg, 'uiId'>,
          sent_to: Array.from(sentTo)
        } satisfies Ws_Message_Send_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleNewMessage | input:`, message, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        ui_id: uiId,
        error: transformError(e)
      } satisfies Ws_Message_Send_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
