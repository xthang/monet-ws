import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db/index'
import { WsUpdateConversationRequestData } from '@/types/ws/request'
import { WsResponseFullPayload, WsUpdateConversationReceipt } from '@/types/ws/response'
import { findUniqueConversationMembershipOrThrow } from '@/utils/db'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleUpdateGroup(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsUpdateConversationRequestData
) {
  // Validate inputs
  const input = WsUpdateConversationRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { conversationId, data } = input
  const { name, description, photo, baseCurrency, note } = data

  try {
    // check permission
    const membership = await findUniqueConversationMembershipOrThrow(db, conversationId, accountId, orgId, {
      select: { conversation: true }
    })
    const existedConversation = membership.conversation

    return db.$transaction(async (tx) => {
      let updatedConversation
      if (Object.entries(data).filter(([_, v]) => v !== undefined).length) {
        const lastActiveAccountSet = new Set(existedConversation.lastActiveAccounts?.split(','))
        lastActiveAccountSet.add(accountId)
        const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

        updatedConversation = await tx.conversation.update({
          where: { id: conversationId, orgId: orgId ?? null },
          data: {
            name,
            description,
            photo,
            baseCurrency,
            note,
            updatedBy: accountId,
            lastActivityAt: new Date(),
            lastActiveAccounts
          }
        })
      }

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.conversation,
          objectId: conversationId,
          type: ActivityLogType.conversation_update,
          details: input.data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      if (!updatedConversation) return

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, conversationId, {
        event: 'updated-conversation',
        orgId,
        data: { conversation: updatedConversation }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          conversation_id: conversationId,
          conversation: updatedConversation,
          sent_to: Array.from(sentTo)
        } satisfies WsUpdateConversationReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateGroup ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        conversation_id: conversationId,
        error: transformError(e)
      } satisfies WsUpdateConversationReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
