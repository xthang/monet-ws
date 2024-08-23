import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import type { WsMoneyRecord } from '@/types/ws/message'
import { WsSettleUpPayableRequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, WsSettleUpPayableReceipt } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../../db/queries'
import { MEMBER_SELECT_FULL_FOR_NOTIFY, MONEY_RECORD_SELECT } from '../../../db/query-constants'
import { transformAccountAlias } from '../../../db/transform/account-alias'
import { fromDbLocale } from '../../../db/transform/locale'
import getNotificationRecipientInfoFromMembership, {
  getMemberName
} from '../../../notify/get-notification-recipient-info-from-membership'
import notifySettleItems from '../../../notify/notify-settled-item'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleSettleUpPayable(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsSettleUpPayableRequestData
) {
  // Validate inputs
  const input = WsSettleUpPayableRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, tabId, settlementId, description } = input

  try {
    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { id: true, group: true }
    })
    const { group } = membership

    const {
      payorMemberId,
      payorMember: payorMemberForNotify_,
      payeeMemberId,
      payeeMember: payeeMemberForNotify_,
      amount: payableAmount
    } = await db.groupTabSuggestedSettlement.findUniqueOrThrow({
      where: { id: settlementId, groupId, tabId, settlementRecordId: null, isActive: true },
      select: {
        payorMemberId: true,
        payorMember: { select: MEMBER_SELECT_FULL_FOR_NOTIFY },
        payeeMemberId: true,
        payeeMember: { select: MEMBER_SELECT_FULL_FOR_NOTIFY },
        amount: true
      }
    })

    return db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          groupId,
          tabId,
          sentAt: new Date(),
          sentBy: accountId,
          createdBy: accountId
        }
      })

      const { amount, rate, amountPerPartaker, payerMember, partakers, ...moneyRecord } = await tx.moneyRecord.create({
        data: {
          groupId,
          tabId,
          messageId: message.id,

          type: $Enums.MoneyRecordType.settlement,
          settlementId,
          description: description ?? 'Reimbursement',
          payerMemberId: payorMemberId,
          currency: group.baseCurrency,
          amount: payableAmount,

          partakers: { create: { memberId: payeeMemberId, proportion: 1, createdBy: accountId } },

          createdBy: accountId
        },
        select: MONEY_RECORD_SELECT
      })

      await tx.message.update({ where: { id: message.id }, data: { moneyRecordId: moneyRecord.id } })

      await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastMessageId: moneyRecord.messageId, lastActivityAt: new Date(), lastActiveAccounts }
      })

      await tx.groupTabSuggestedSettlement.update({
        where: { id: settlementId },
        data: { settlementRecordId: moneyRecord.id, settledAt: new Date() }
      })

      // queue Email/SMS
      const payorMemberForNotify = {
        ...payorMemberForNotify_,
        account: payorMemberForNotify_.account && {
          ...payorMemberForNotify_.account,
          locale: payorMemberForNotify_.account.locale && fromDbLocale(payorMemberForNotify_.account.locale)
        }
      }
      const payeeMemberForNotify = {
        ...payeeMemberForNotify_,
        account: payeeMemberForNotify_.account && {
          ...payeeMemberForNotify_.account,
          locale: payeeMemberForNotify_.account.locale && fromDbLocale(payeeMemberForNotify_.account.locale)
        }
      }

      const toSendNoti = []
      if (membership.id !== payorMemberId) {
        const recipientInfo = getNotificationRecipientInfoFromMembership(payorMemberForNotify, locale).map((it) => ({
          ...it,
          role: 'payor' as const
        }))
        toSendNoti.push(...recipientInfo)
      }
      if (membership.id !== payeeMemberId) {
        const recipientInfo = getNotificationRecipientInfoFromMembership(payeeMemberForNotify, locale).map((it) => ({
          ...it,
          role: 'payee' as const
        }))
        toSendNoti.push(...recipientInfo)
      }
      if (toSendNoti.length) {
        await notifySettleItems(tx, group, tabId, toSendNoti, {
          payor: { name: getMemberName(payorMemberForNotify) ?? '[no name]' },
          payee: { name: getMemberName(payeeMemberForNotify) ?? '[no name]' },
          currency: group.baseCurrency,
          amount: amount!.toNumber(),
          messageId: message.id
        })
      }

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.groupTabSettlement_settle,
          details: input,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      // List all accounts that are in the org for checking
      let orgMemberAccountIds: string[] | undefined
      if (orgId) {
        const accountIds = new Set(
          [
            payerMember.accountAlias?.accountId,
            ...partakers.flatMap((p) => [p.member.accountId, p.member.accountAlias?.accountId])
          ].filter<string>((it): it is string => !!it)
        )
        const orgMembers = await db.organizationMembership.findMany({
          where: { orgId, accountId: { in: Array.from(accountIds) } }
        })
        orgMemberAccountIds = orgMembers.map((m) => m.accountId)
      }

      const wsMoneyRecord: WsMoneyRecord = {
        payerMember: payerMember && {
          ...payerMember,
          account: payerMember.account,
          accountAlias:
            payerMember.accountAlias && transformAccountAlias(payerMember.accountAlias, orgMemberAccountIds),
          notInOrg:
            orgMemberAccountIds && payerMember.accountId != null && !orgMemberAccountIds.includes(payerMember.accountId)
        },
        amount: amount?.toNumber() ?? null,
        rate: rate?.toNumber() ?? null,
        partakers: Object.fromEntries(
          partakers.map(({ memberId, member: { accountAlias, ...member }, proportion, ...p }) => [
            memberId,
            {
              ...p,
              member: {
                ...member,
                accountAlias: accountAlias && transformAccountAlias(accountAlias, orgMemberAccountIds),
                notInOrg:
                  orgMemberAccountIds && member.accountId != null && !orgMemberAccountIds.includes(member.accountId)
              },
              proportion: proportion?.toNumber() ?? null
            }
          ])
        ),
        amountPerPartaker: amountPerPartaker?.toNumber() ?? null,
        ...moneyRecord
      }

      const wsMessage = { ...message, moneyRecordId: wsMoneyRecord.id, moneyRecord: wsMoneyRecord }

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'new-payable-settlement',
        orgId,
        data: wsMessage
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          tab_id: tabId,
          settlement_id: settlementId,
          message: wsMessage,
          sent_to: Array.from(sentTo)
        } satisfies WsSettleUpPayableReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateMoneyRecord ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        settlement_id: settlementId,
        error: transformError(e)
      } satisfies WsSettleUpPayableReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
