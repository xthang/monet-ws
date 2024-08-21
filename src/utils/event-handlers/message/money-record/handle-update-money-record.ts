import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db/index'
import type { WsMoneyRecord } from '@/types/ws/message'
import { WsUpdateMoneyRecordRequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, WsUpdateMoneyRecordReceipt } from '@/types/ws/response'

import calculateTabSettlement from '../../../db/calculate-conversation-tab-settlement'
import { MESSAGE_SELECT, MONEY_RECORD_SELECT } from '../../../db/const'
import { findUniqueMessageOrThrow } from '../../../db/index'
import { transformAccountAlias } from '../../../db/transform/account-alias'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleUpdateMoneyRecord(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsUpdateMoneyRecordRequestData
) {
  // Validate inputs
  const input = WsUpdateMoneyRecordRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { conversationId, tabId, data } = input

  try {
    // check permission
    const [membership, message] = await findUniqueMessageOrThrow(
      db,
      conversationId,
      tabId,
      data.messageId,
      accountId,
      orgId,
      {
        membership: { select: { conversation: { select: { baseCurrency: true, lastActiveAccounts: true } } } },
        message: { select: MESSAGE_SELECT }
      }
    )
    const { conversation } = membership

    return await db.$transaction(async (tx) => {
      const updatedMoneyRecord = await tx.moneyRecord.update({
        where: { id: data.id, conversationId, messageId: data.messageId },
        data: { ...data, updatedBy: accountId },
        select: MONEY_RECORD_SELECT
      })

      const lastActiveAccountSet = new Set(conversation.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      const affectedUpdate =
        data.payerMemberId !== undefined ||
        data.currency !== undefined ||
        data.amount !== undefined ||
        data.ratePerBase !== undefined ||
        data.rate !== undefined ||
        data.amountPerPartaker !== undefined
      if (affectedUpdate) await calculateTabSettlement(accountId, tx, conversationId, conversation, tabId)

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.conversation,
          objectId: conversationId,
          type: ActivityLogType.moneyRecord_upsert,
          details: data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      const { payerMember, amount, rate, partakers, amountPerPartaker, ...otherMoneyRecordData } = updatedMoneyRecord

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
        ...otherMoneyRecordData
      }

      const wsMessage = { ...message, moneyRecordId: wsMoneyRecord.id, moneyRecord: wsMoneyRecord }

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, conversationId, {
        event: 'updated-money-record',
        orgId,
        data: wsMessage
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          conversation_id: conversationId,
          tab_id: tabId,
          message_id: message.id,
          money_record_id: updatedMoneyRecord.id,
          message: wsMessage,
          sent_to: Array.from(sentTo)
        } satisfies WsUpdateMoneyRecordReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateMoneyRecord ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        conversation_id: conversationId,
        tab_id: tabId,
        message_id: data.messageId,
        money_record_id: data.id,
        error: transformError(e)
      } satisfies WsUpdateMoneyRecordReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
