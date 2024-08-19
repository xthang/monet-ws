import { ActivityLogObjectType } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import type { WsDeleteMessageRequestData } from '@/types/ws/request.js'

import { ActivityLogType } from '../../constants/data.js'
import type { Locale } from '../../constants/locales.js'
import db from '../../db/index.js'
import type { WsDeleteMessageReceipt, WsResponseFullPayload } from '../../types/ws/response.js'
import calculateTabSettlement from '../db/calculate-conversation-tab-settlement.js'
import { findUniqueConversationMembershipOrThrow } from '../db/index.js'
import { broadcastToGroupMembersExceptMe } from '../ws/broadcast-to-group-members-except-me.js'
import { transformError } from '../ws/transform-error.js'

export default async function handleDeleteMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  message: WsDeleteMessageRequestData
) {
  const { accountId, orgId } = ws.auth
  const { conversationId, tabId, id: messageId } = message

  try {
    // check permission
    const membership = await findUniqueConversationMembershipOrThrow(db, conversationId, accountId, orgId, {
      select: { conversation: true }
    })
    const { conversation } = membership

    return db.$transaction(async (tx) => {
      const deleted = await tx.message.softDelete({
        tx,
        where: { id: messageId, conversationId },
        deletedBy: accountId,
        select: {
          id: true,
          conversationId: true,
          tabId: true,
          moneyRecordId: true,
          deletedAt: true,
          deletedBy: true,
          deletedByAccount: true,
          sentAt: true,
          sentBy: true
        }
      })

      if (deleted.moneyRecordId) {
        const deletedMoneyRecord = await tx.moneyRecord.softDelete({
          tx,
          where: { id: deleted.moneyRecordId, conversationId_messageId: { conversationId, messageId } },
          deletedBy: accountId
        })

        if (deletedMoneyRecord) {
          await calculateTabSettlement(accountId, tx, conversationId, conversation, deleted.tabId)

          await tx.activityLog.create({
            data: {
              objectType: ActivityLogObjectType.conversation,
              objectId: conversationId,
              type: ActivityLogType.moneyRecord_delete,
              details: { messageId: deleted.id, monetRecordId: deletedMoneyRecord.id },
              detailsVersion: '1.0.0',
              createdBy: accountId
            }
          })
        }
      }

      const lastActiveAccountSet = new Set(conversation.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, conversationId, {
        event: 'deleted-message',
        orgId,
        data: deleted
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          conversation_id: conversationId,
          tab_id: tabId,
          message_id: messageId,
          message: deleted,
          sent_to: Array.from(sentTo)
        } satisfies WsDeleteMessageReceipt
      }
      ws.send(JSON.stringify(payload))

      return deleted
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleDeleteMessage ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        conversation_id: conversationId,
        tab_id: tabId,
        message_id: messageId,
        error: transformError(e)
      } satisfies WsDeleteMessageReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
