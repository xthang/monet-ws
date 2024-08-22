import { type WebSocketServer, WebSocket } from 'ws'

import type { Locale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode } from '@/types/error'
import type { WsSendMessageRequestData } from '@/types/ws/request'
import type { WsChatMessageReceipt, WsResponseFullPayload } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../db'
import { MESSAGE_SELECT } from '../../db/query-constants'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export default async function handleNewMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  message: WsSendMessageRequestData
) {
  const { accountId, orgId } = ws.auth
  const { groupId, tabId, uiId, text, sentAt } = message

  try {
    // validate inputs
    // check if the diff between sent time & current server time is too large
    const timeDiff = Math.abs(sentAt.getTime() - Date.now())
    if (timeDiff > 5 * 60 * 10e3) {
      throw new WsError(
        WsErrorCode.BAD_REQUEST,
        `the diff between sent time (${sentAt}) & current server time (${new Date()}) is too large (${timeDiff})`
      )
    }

    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })
    const { group } = membership

    return await db.$transaction(async (tx) => {
      const createdMsg = await tx.message.create({
        data: { uiId, groupId, tabId, text, sentAt, sentBy: accountId, createdBy: accountId },
        select: MESSAGE_SELECT
      })
      const { uiId: createdUiId, ...createdMsgWithoutUiId } = createdMsg

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      const _updatedConvo = await tx.group.update({
        where: { id: groupId },
        data: { lastMessageId: createdMsg.id, lastMessageAt: new Date(), lastActiveAccounts }
      })

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'new-message',
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
        } satisfies WsChatMessageReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleNewMessage ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        ui_id: uiId,
        error: transformError(e)
      } satisfies WsChatMessageReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
