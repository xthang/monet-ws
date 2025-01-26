import assert from 'assert'

import { $Enums } from '@prisma/client'
import type { AccountAlias, GroupMembership } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { FREE_PLAN_MAX_GROUP_MEMBERS } from '@/constants/env'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import type { AccountBasicInfo } from '@/types/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
import type { WsMessageFullPayload } from '@/types/ws/message.d'
import { Ws_GroupMembershipRequest_Action_RequestData } from '@/types/ws/request'
import type { Ws_GroupMembershipRequest_Action_Receipt, WsResponseFullPayload } from '@/types/ws/response'
import { findUniqueAccountOrThrow, findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
import { ACCOUNT_ALIAS_SELECT, ACCOUNT_SELECT, MEMBER_SELECT_WHERE } from '@/utils/db/query-constants'
import { fromDbLocale } from '@/utils/db/transform/locale'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyUpdatedGroupMembers from '@/utils/notify/group-membership/notify-updated-group-members'
import notifyHandledGroupMembershipRequest from '@/utils/notify/group-membership-request/notify-handled-group-membership-request'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleGroupMembershipRequestAction(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_GroupMembershipRequest_Action_RequestData
) {
  // Validate inputs
  const input = Ws_GroupMembershipRequest_Action_RequestData.parse(rawInput)

  const { accountId, orgId, otherAccountInfo } = ws.auth
  const { groupId, requestId: membershipRequestId, accountId: requestAccountId, action, replacedMemberId } = input

  try {
    // check permission
    const {
      group: { orgId: groupOrgId, memberships, ...group },
      role: memberRole
    } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: {
        group: {
          select: {
            id: true,
            name: true,
            orgId: true,
            memberships: {
              where: { deletedAt: null, deletedBy: null, isActive: true },
              select: MEMBER_SELECT_WHERE
            }
          }
        },
        role: true
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

    if (action === 'approve' || action === 'replace') {
      // Check if account is in the org
      if (groupOrgId)
        await db.organizationMembership.findUniqueOrThrow({
          where: { orgId_accountId_isActive: { orgId: groupOrgId, accountId: requestAccountId, isActive: true } }
        })
    }

    if (action === 'approve') {
      const hasProGroupAdmin = memberships.some(
        (m) =>
          m.role === $Enums.GroupMemberRole.admin &&
          m.account?.subscriptionPlan &&
          m.account.subscriptionEndedAt! > new Date()
      )

      if (memberships.length >= FREE_PLAN_MAX_GROUP_MEMBERS && !hasProGroupAdmin) {
        throw new WsError(
          WsHttpCode.BAD_REQUEST,
          WsErrorCode.GROUP_MEMBERS_MAXIMUM_REACHED,
          'Maximum group members reached'
        )
      }
    }

    let replacedMember:
      | (Pick<GroupMembership, 'id' | 'accountId' | 'accountAliasId' | 'role'> & {
          account: (AccountBasicInfo & { locale: $Enums.Locale | null; accountAliases: AccountAlias[] }) | null
          accountAlias: AccountAlias | null
        })
      | undefined
    if (action === 'replace') {
      if (!replacedMemberId) {
        throw new WsError(WsHttpCode.BAD_REQUEST, null, 'field required: replacedMemberId')
      }

      replacedMember = await db.groupMembership.findUniqueOrThrow({
        where: {
          id: replacedMemberId,
          groupId,
          deletedAt: null,
          isActive: true
        },
        select: {
          id: true,
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
          accountAlias: { where: { deletedAt: null, isActive: true } }, // verificationStatus: 'verified'
          role: true
        }
      })

      if (
        (replacedMember.role === $Enums.GroupMemberRole.admin || replacedMember.role === $Enums.GroupMemberRole.mod) &&
        memberRole !== $Enums.GroupMemberRole.admin
      ) {
        throw new WsError(
          WsHttpCode.FORBIDDEN,
          WsErrorCode.NOT_ALLOWED,
          'You do not have permission to replace an admin/moderator'
        )
      }
    }

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
      } else if (action === 'replace') {
        assert(replacedMember, 'replacedMember')

        await tx.groupMembership.update({
          where: {
            id: replacedMember.id,
            deletedAt: null,
            isActive: true
          },
          data: {
            accountId: requestAccountId,
            accountAliasId: null,
            accountPlaceholderId: null,
            accountOrPlaceholderId: requestAccountId,
            addedByAccountId: accountId,
            updatedBy: accountId
          }
        })

        // queue Email/SMS to replaced member
        const toSendNoti = getNotificationRecipientInfoFromMembership(
          {
            ...replacedMember,
            account: replacedMember.account && {
              ...replacedMember.account,
              locale: replacedMember.account.locale && (fromDbLocale(replacedMember.account.locale) as SupportedLocale)
            }
          },
          locale
        ).map((it) => ({ ...it, type: 'removed' as const }))
        if (toSendNoti.length) await notifyUpdatedGroupMembers(group, toSendNoti, otherAccountInfo, tx)
      }

      await db.groupMembershipRequest.update({
        where: {
          id: membershipRequestId,
          groupId_accountId_isActive: { groupId, accountId: requestAccountId, isActive: true }
        },
        data:
          action === 'approve' || action === 'replace'
            ? { isActive: null, approvedBy: accountId, approvedAt: new Date() }
            : { isActive: null, rejectedBy: accountId, rejectedAt: new Date() }
      })

      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: SupportedLocale | null
        channel: 'email' | 'sms'
        address: string
      }[] = getNotificationRecipientInfoFromMembership(
        {
          account: {
            ...requestAccount,
            locale: requestAccount.locale && (fromDbLocale(requestAccount.locale) as SupportedLocale)
          }
        },
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
