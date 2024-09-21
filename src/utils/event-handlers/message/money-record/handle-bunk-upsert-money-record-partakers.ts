import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import type { WsMoneyRecord } from '@/types/ws/message'
import { Ws_MoneyRecordPartakers_Upsert_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_MoneyRecord_Update_Receipt } from '@/types/ws/response'

import calculateTabSettlement from '../../../db/calculate-group-tab-settlement'
import { findUniqueMoneyRecordOrThrow } from '../../../db/queries'
import { MESSAGE_SELECT, MONEY_RECORD_PARTAKER_SELECT, MONEY_RECORD_SELECT } from '../../../db/query-constants'
import { transformAccountAlias } from '../../../db/transform/account-alias'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { partakers, ...MONEY_RECORD_SELECT_NO_PARTAKERS } = MONEY_RECORD_SELECT

export default async function handleUpsertMoneyRecordPartakers(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_MoneyRecordPartakers_Upsert_RequestData
) {
  // Validate inputs
  const input = Ws_MoneyRecordPartakers_Upsert_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, tabId, messageId, moneyRecordId, data } = input

  try {
    // check permission
    const [membership, { groupTab, ...message }, moneyRecord] = await findUniqueMoneyRecordOrThrow(
      db,
      groupId,
      tabId,
      messageId,
      moneyRecordId,
      accountId,
      orgId,
      {
        membership: { select: { group: { select: { lastActiveAccounts: true } } } },
        message: { select: { ...MESSAGE_SELECT, groupTab: true } },
        moneyRecord: {
          select: {
            ...MONEY_RECORD_SELECT_NO_PARTAKERS,
            expenseDocuments: { where: { deletedBy: null, deletedAt: null }, select: { id: true, fileName: true } }
          }
        }
      }
    )
    const { group } = membership

    const calls = []

    const upserts = data
      .filter((it): it is Exclude<(typeof data)[number], { id: string }> => !('id' in it) || !it.id)
      .map((it) =>
        db.moneyRecordPartaker.upsert({
          // Do not set where.moneyRecordId so that Prisma Client uses a database upsert, and this Error won't happen:
          // Invalid `prisma.moneyRecordPartaker.upsert()` invocation:
          // Unique constraint failed on the fields: (`moneyRecordId`,`memberId`,`isActive`)
          // https://www.prisma.io/docs/orm/reference/prisma-client-reference#database-upserts
          where: { moneyRecordId_memberId_isActive: { moneyRecordId, memberId: it.memberId, isActive: true } },
          create: { moneyRecordId, ...it, createdBy: accountId, isActive: true },
          update: { ...it, updatedBy: accountId }
        })
      )
    calls.push(...upserts)

    const updates = data
      .filter((it): it is Extract<(typeof data)[number], { id: string }> => 'id' in it && !!it.id)
      .map(({ id, ...it }) =>
        db.moneyRecordPartaker.update({
          where: { id: id!, moneyRecordId },
          data: { ...it, updatedBy: accountId }
        })
      )
    calls.push(...updates)

    if (upserts.length || updates.length) {
      const tabUpdate = db.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })
      calls.push(tabUpdate)

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      const groupUpdate = db.group.update({
        where: { id: groupId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })
      calls.push(groupUpdate)
    }

    const logInsert = db.activityLog.create({
      data: {
        objectType: $Enums.ActivityLogObjectType.group,
        objectId: groupId,
        type: ActivityLogType.moneyRecord_update,
        details: data,
        detailsVersion: '1.0.0',
        createdBy: accountId
      }
    })
    calls.push(logInsert)

    const res = await db.$transaction(calls)

    await calculateTabSettlement(accountId, db, groupId, tabId, groupTab)

    // BROADCAST ...

    const partakers = await db.moneyRecordPartaker.findMany({
      where: { moneyRecordId },
      select: MONEY_RECORD_PARTAKER_SELECT
    })

    const { payerMember, amount, rate, amountPerPartaker, ...otherMoneyRecordData } = moneyRecord

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
        accountAlias: payerMember.accountAlias && transformAccountAlias(payerMember.accountAlias, orgMemberAccountIds),
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

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'money-record--updated',
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
        message_id: message.id,
        money_record_id: moneyRecord.id,
        message: wsMessage,
        sent_to: Array.from(sentTo)
      } satisfies Ws_MoneyRecord_Update_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpsertMoneyRecordPartakers | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        message_id: messageId,
        money_record_id: moneyRecordId,
        error: transformError(e)
      } satisfies Ws_MoneyRecord_Update_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
