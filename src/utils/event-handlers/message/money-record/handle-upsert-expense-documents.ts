import { $Enums, type Prisma } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import type { WsMoneyRecord } from '@/types/ws/message'
import { Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_MoneyRecord_ExpenseDocuments_Upsert_Receipt } from '@/types/ws/response'

import { findUniqueMoneyRecordOrThrow } from '../../../db/queries'
import { MESSAGE_SELECT, MONEY_RECORD_SELECT } from '../../../db/query-constants'
import { transformAccountAlias } from '../../../db/transform/account-alias'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleUpsertExpenseDocuments(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData
) {
  // Validate inputs
  const input = Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, tabId, messageId, moneyRecordId, data } = input

  try {
    // check permission
    const [membership, message, moneyRecord] = await findUniqueMoneyRecordOrThrow(
      db,
      groupId,
      tabId,
      messageId,
      moneyRecordId,
      accountId,
      orgId,
      {
        membership: { select: { group: { select: { baseCurrency: true, lastActiveAccounts: true } } } },
        message: { select: MESSAGE_SELECT },
        moneyRecord: { select: MONEY_RECORD_SELECT }
      }
    )
    const { group } = membership

    await db.$transaction(async (tx) => {
      const { create, update, delete: deletes } = data

      let created
      if (create?.length)
        created = await tx.expenseDocument.createMany({
          data: create.map<Prisma.ExpenseDocumentCreateManyInput>((it) => ({
            ...it,
            groupId,
            tabId,
            moneyRecordId,
            storageVersion: 1,
            createdBy: accountId,
            uploadedAt: new Date(),
            uploadedBy: accountId
          }))
        })

      let updated
      if (update?.length)
        for (const { id, ...it } of update)
          await tx.expenseDocument.update({
            where: { id, groupId, tabId, moneyRecordId },
            data: { ...it, updatedBy: accountId }
          })

      let deleted
      if (deletes?.length)
        deleted = await tx.expenseDocument.softDeletes({
          where: { ids: deletes, groupId, tabId, moneyRecordId },
          deletedBy: accountId,
          tx
        })

      if (created || updated || deleted) {
        await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

        const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
        lastActiveAccountSet.add(accountId)
        const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

        await tx.group.update({ where: { id: groupId }, data: { lastActivityAt: new Date(), lastActiveAccounts } })
      }

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.moneyRecord_update,
          details: data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })
    })

    // BROADCAST ...

    const expenseDocuments = await db.expenseDocument.findMany({
      where: { groupId, tabId, moneyRecordId },
      select: { id: true, fileName: true }
    })

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
      expenseDocuments,
      ...otherMoneyRecordData
    }

    const wsMessage = { ...message, moneyRecordId: wsMoneyRecord.id, moneyRecord: wsMoneyRecord }

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'money-record--expense-docs--upserted',
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
      } satisfies Ws_MoneyRecord_ExpenseDocuments_Upsert_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpsertExpenseDocuments | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        message_id: messageId,
        money_record_id: moneyRecordId,
        error: transformError(e)
      } satisfies Ws_MoneyRecord_ExpenseDocuments_Upsert_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
