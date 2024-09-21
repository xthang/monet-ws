import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import type { WsMoneyRecord } from '@/types/ws/message'
import { Ws_MoneyRecord_Create_RequestData } from '@/types/ws/request'
import type { Ws_Message_Send_Receipt, WsResponseFullPayload } from '@/types/ws/response'

import calculateTabSettlement from '../../../db/calculate-group-tab-settlement'
import { findUniqueGroupMembershipOrThrow } from '../../../db/queries'
import { MESSAGE_SELECT, MONEY_RECORD_SELECT } from '../../../db/query-constants'
import { transformAccountAlias } from '../../../db/transform/account-alias'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleCreateMoneyRecord(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_MoneyRecord_Create_RequestData
) {
  // Validate inputs
  const input = Ws_MoneyRecord_Create_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const {
    groupId,
    tabId,
    data: { uiId, sentAt, ...data }
  } = input
  // const { isInTestMode } = ctx.configs

  try {
    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    return await db.$transaction(async (tx) => {
      const createdMsg_ = await tx.message.create({
        data: { groupId, tabId, uiId, sentAt, sentBy: accountId, createdBy: accountId },
        select: MESSAGE_SELECT
      })

      const moneyRecord = await tx.moneyRecord.create({
        data: {
          ...data,
          groupId,
          tabId,
          messageId: createdMsg_.id,
          createdBy: accountId
        },
        select: {
          ...MONEY_RECORD_SELECT,
          expenseDocuments: { where: { deletedBy: null, deletedAt: null }, select: { id: true, fileName: true } }
        }
      })

      const { uiId: createdUiId, ...createdMsg } = await tx.message.update({
        where: { id: createdMsg_.id },
        data: { moneyRecordId: moneyRecord.id }
      })

      const tab = await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastMessageId: createdMsg.id, lastActivityAt: new Date(), lastActiveAccounts }
      })

      await calculateTabSettlement(accountId, tx, groupId, tabId, tab)

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.moneyRecord_upsert,
          details: data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      const { payerMember, amount, rate, partakers, amountPerPartaker, ...otherMoneyRecordData } = moneyRecord

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

      const wsMessageWithoutUiId = {
        ...createdMsg,
        moneyRecordId: wsMoneyRecord.id,
        moneyRecord: wsMoneyRecord
      }

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'message--text--new',
        orgId,
        data: wsMessageWithoutUiId
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          tab_id: tabId,
          ui_id: createdUiId!,
          message: { ...wsMessageWithoutUiId, uiId: createdUiId! },
          sent_to: Array.from(sentTo)
        } satisfies Ws_Message_Send_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleCreateMoneyRecord | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        ui_id: uiId,
        error: transformError(e)
      } satisfies Ws_Message_Send_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
