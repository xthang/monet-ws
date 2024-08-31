import { type WebSocketServer, WebSocket } from 'ws'

import type { Locale } from '@/constants/locales'
import db from '@/db'
import type { WsMessageFullPayload } from '@/types/ws/message.d'
import { Ws_GroupMembershipRequest_Action_RequestData } from '@/types/ws/request'
import type { Ws_GroupMembershipRequest_Action_Receipt, WsResponseFullPayload } from '@/types/ws/response'
import { findUniqueAccountOrThrow, findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
import { ACCOUNT_ALIAS_SELECT, MEMBER_SELECT_WHERE } from '@/utils/db/query-constants'
import { fromDbLocale } from '@/utils/db/transform/locale'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyHandledGroupMembershipRequest from '@/utils/notify/group-membership-request/notify-handled-group-membership-request'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleGroupMembershipRequestAction(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: Ws_GroupMembershipRequest_Action_RequestData
) {
  // Validate inputs
  const input = Ws_GroupMembershipRequest_Action_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, requestId: membershipRequestId, accountId: requestAccountId, action } = input

  try {
    // check permission
    const {
      group: { memberships, ...group }
    } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: {
        group: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { deletedAt: null, deletedBy: null, isActive: true },
              select: MEMBER_SELECT_WHERE
            }
          }
        }
      }
    })

    // validate
    const requestAccount = await findUniqueAccountOrThrow(db, requestAccountId, {
      select: {
        accountAliases: {
          where: { verificationStatus: 'verified', deletedAt: null, isActive: true },
          select: ACCOUNT_ALIAS_SELECT
        }
      }
    })
    await db.groupMembershipRequest.findUniqueOrThrow({
      where: {
        id: membershipRequestId,
        groupId_accountId_isActive: { groupId, accountId: requestAccountId, isActive: true },
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null
      }
    })

    return await db.$transaction(async (tx) => {
      if (action === 'approve') {
        await tx.groupMembership.create({
          data: {
            groupId,
            accountId: requestAccount.id,
            accountOrPlaceholderId: requestAccount.id,
            addedByAccountId: accountId,
            order: Math.max(...memberships.map((m) => m.order)) + 1,
            createdBy: accountId
          }
        })
      }

      await db.groupMembershipRequest.update({
        where: {
          id: membershipRequestId,
          groupId_accountId_isActive: { groupId, accountId: requestAccountId, isActive: true }
        },
        data:
          action === 'approve'
            ? { isActive: null, approvedBy: accountId, approvedAt: new Date() }
            : { isActive: null, rejectedBy: accountId, rejectedAt: new Date() }
      })

      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: Locale | null
        channel: 'email' | 'sms'
        address: string
      }[] = getNotificationRecipientInfoFromMembership(
        { account: { ...requestAccount, locale: requestAccount.locale && fromDbLocale(requestAccount.locale) } },
        locale
      )

      // queue Email/SMS
      await notifyHandledGroupMembershipRequest(group, toSendNoti, action, tx)

      // BROADCAST ...

      const broadcastPayload = {
        event: 'group-membership-request--action',
        orgId,
        data: { groupId: group.id, action }
      } satisfies WsMessageFullPayload

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, broadcastPayload)

      // broadcast to newly rejected account
      if (action === 'reject' && !sentTo.has(requestAccount.id)) {
        console.log(`--> sending group--membership-request--action to:`, requestAccount.id)
        wss.socketsByAccount[requestAccount.id]?.clients.forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN && client.auth.orgId == orgId) {
            client.send(JSON.stringify(broadcastPayload))
            sentTo.add(requestAccount.id)
          }
        })
      }

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          request_id: membershipRequestId,
          account_id: requestAccountId,
          sent_to: Array.from(sentTo)
        } satisfies Ws_GroupMembershipRequest_Action_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleGroupMembershipRequestAction | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        request_id: membershipRequestId,
        account_id: requestAccountId,
        error: transformError(e)
      } satisfies Ws_GroupMembershipRequest_Action_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
