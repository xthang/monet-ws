import type { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import db from '../../db/index.js'
import { findUniqueConversationMembershipOrThrow } from '../../db/utils/index.js'
import { ApiError, ApiErrorCode } from '../../types/error.js'
import type { WsSendMessageRequestData } from '../../types/ws/request.js'
import { WsResponseData } from '../../types/ws/response.js'

export default async function handleNewMessage(wss: WebSocketServer, ws: WebSocket, locale: $Enums.Locale, message: WsSendMessageRequestData) {
  const { accountId, orgId } = ws.auth
  const { uiId, conversationId, tabId, text, sentAt } = message

  // validate inputs
  // check if the diff between sent time & current server time is too large
  const timeDiff = Math.abs(sentAt.getTime() - Date.now())
  if (timeDiff > 5 * 60 * 10e3) {
    throw new ApiError(ApiErrorCode.BAD_REQUEST, `the diff between sent time (${sentAt}) & current server time (${new Date()}) is too large (${timeDiff})`)
  }

  // check permission
  const membership = await findUniqueConversationMembershipOrThrow(db, conversationId, accountId, orgId, {
    conversation: true
  })
  const conversation = membership.conversation

  return await db.$transaction(async (tx) => {
    const createdMsg = await tx.message.create({
      data: {
        uiId,
        conversationId,
        tabId,
        text,
        sentAt,
        sentBy: accountId,
        createdBy: accountId
      }
    })

    const lastActiveAccountSet = new Set(conversation.lastActiveAccounts?.split(','))
    lastActiveAccountSet.add(accountId)
    const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

    const _updatedConvo = await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageId: createdMsg.id, lastMessageAt: new Date(), lastActiveAccounts }
    })

    // A client WebSocket broadcasting to every other connected WebSocket clients, excluding itself.
    const memberships = await tx.conversationMembership.findMany({
      where: { conversationId, AND: [{ accountId: { not: null } }, { accountId: { not: accountId } }], isActive: true },
      select: { accountId: true }
    })

    const sentTo = new Set<string>()
    for (const { accountId: mAccountId } of memberships.concat([{ accountId }])) {
      wss.socketsByAccount[mAccountId!]?.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN && client.auth.orgId == orgId) {
          const payload: WsResponseData = { event: 'new-chat-message', orgId, data: createdMsg }
          client.send(JSON.stringify(payload))
          sentTo.add(mAccountId!)
        }
      })
    }

    // send receipt back to itself
    const payload: WsResponseData = {
      event: 'chat-message-receipt',
      orgId,
      data: { conversation_id: conversationId, tab_id: tabId, message_id: createdMsg.id, ui_id: createdMsg.uiId!, sent_to: Array.from(sentTo) }
    }
    ws.send(JSON.stringify(payload))

    return createdMsg
  })
}
