import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import type { Locale } from '@/constants/locales'
import db from '@/db/index'
import { WsError, WsErrorCode } from '@/types/error'
import { WsDeleteConversationRequestData } from '@/types/ws/request'
import { WsResponseFullPayload, WsDeleteConversationReceipt } from '@/types/ws/response'
import { findUniqueConversationMembershipOrThrow } from '@/utils/db'
import { ACCOUNT_SELECT } from '@/utils/db/const'
import { fromDbLocale } from '@/utils/db/transform/locale'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyDeletedConversation from '@/utils/notify/notify-deleted-conversation'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleDeleteGroup(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsDeleteConversationRequestData
) {
  // Validate inputs
  const conversationId = WsDeleteConversationRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth

  try {
    // Check member permission
    const membership = await findUniqueConversationMembershipOrThrow(db, conversationId, accountId, orgId)
    if (membership.role !== $Enums.ConversationMemberRole.admin) throw new WsError(WsErrorCode.FORBIDDEN, 'Forbidden')

    return db.$transaction(async (tx) => {
      const memberships = await tx.conversationMembership.findMany({
        where: { conversationId, accountId: { not: accountId }, isActive: true },
        select: {
          accountId: true,
          accountAliasId: true,
          account: {
            where: { deletedAt: null, isActive: true },
            select: {
              ...ACCOUNT_SELECT,
              locale: true,
              accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
            }
          },
          accountAlias: { where: { deletedAt: null, isActive: true } } // verificationStatus: 'verified'
        }
      })

      const deletedConversation = await tx.conversation.softDelete({
        tx,
        where: { id: conversationId },
        deletedBy: accountId
      })

      // queue Email/SMS
      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: Locale | null
        channel: 'email' | 'sms'
        address: string
      }[] = []
      for (const membership of memberships) {
        const membershipForNotify = {
          ...membership,
          account: membership.account && {
            ...membership.account,
            locale: membership.account.locale && fromDbLocale(membership.account.locale)
          }
        }

        toSendNoti.push(...getNotificationRecipientInfoFromMembership(membershipForNotify, locale))
      }
      await notifyDeletedConversation(deletedConversation, toSendNoti, tx)

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, conversationId, {
        event: 'deleted-conversation',
        orgId,
        data: { conversationId: deletedConversation.id }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: { conversation_id: conversationId, sent_to: Array.from(sentTo) } satisfies WsDeleteConversationReceipt
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
      } satisfies WsDeleteConversationReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
