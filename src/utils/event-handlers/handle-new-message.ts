import { type WebSocketServer, WebSocket } from 'ws'

import type { WsSendMessageRequestData } from '@/types/ws/request.js'

import type { Locale } from '../../constants/locales.js'
import db from '../../db/index.js'
import { WsError, WsErrorCode } from '../../types/error.js'
import type { WsChatMessageReceipt, WsResponseFullPayload } from '../../types/ws/response.js'
import { MESSAGE_SELECT } from '../db/const.js'
import { findUniqueConversationMembershipOrThrow } from '../db/index.js'
import { broadcastToGroupMembersExceptMe } from '../ws/broadcast-to-group-members-except-me.js'
import { transformError } from '../ws/transform-error.js'

export default async function handleNewMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  message: WsSendMessageRequestData
) {
  const { accountId, orgId } = ws.auth
  const { conversationId, tabId, uiId, text, sentAt } = message

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
    const membership = await findUniqueConversationMembershipOrThrow(db, conversationId, accountId, orgId, {
      select: { conversation: true }
    })
    const { conversation } = membership

    return await db.$transaction(async (tx) => {
      const { uiId: createdUiId, ...createdMsg } = await tx.message.create({
        data: { uiId, conversationId, tabId, text, sentAt, sentBy: accountId, createdBy: accountId },
        select: MESSAGE_SELECT
      })

      const lastActiveAccountSet = new Set(conversation.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      const _updatedConvo = await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageId: createdMsg.id, lastMessageAt: new Date(), lastActiveAccounts }
      })

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, conversationId, {
        event: 'new-message',
        orgId,
        data: createdMsg
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          conversation_id: conversationId,
          tab_id: tabId,
          ui_id: createdUiId!,
          message: createdMsg,
          sent_to: Array.from(sentTo)
        } satisfies WsChatMessageReceipt
      }
      ws.send(JSON.stringify(payload))

      return createdMsg
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleNewMessage ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        conversation_id: conversationId,
        tab_id: tabId,
        ui_id: uiId,
        error: transformError(e)
      } satisfies WsChatMessageReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
