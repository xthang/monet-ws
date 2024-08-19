import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '../../constants/data.js'
import type { Locale } from '../../constants/locales.js'
import db from '../../db/index.js'
import type { WsMoneyRecord } from '../../types/ws/message.js'
import { WsUpsertMoneyRecordPartakersRequestData } from '../../types/ws/request.js'
import type { WsResponseFullPayload, WsUpdateMoneyRecordReceipt } from '../../types/ws/response.js'
import calculateTabSettlement from '../db/calculate-conversation-tab-settlement.js'
import { MESSAGE_SELECT, MONEY_RECORD_PARTAKER_SELECT, MONEY_RECORD_SELECT } from '../db/const.js'
import { findUniqueMoneyRecordOrThrow } from '../db/index.js'
import { transformAccountAlias } from '../db/transform.js'
import { broadcastToGroupMembersExceptMe } from '../ws/broadcast-to-group-members-except-me.js'
import { transformError } from '../ws/transform-error.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { partakers, ...MONEY_RECORD_SELECT_NO_PARTAKERS } = MONEY_RECORD_SELECT

export default async function handleUpsertMoneyRecordPartakers(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsUpsertMoneyRecordPartakersRequestData
) {
  // Validate inputs
  const input = WsUpsertMoneyRecordPartakersRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { conversationId, tabId, messageId, moneyRecordId, data } = input

  try {
    // check permission
    const [membership, message, moneyRecord] = await findUniqueMoneyRecordOrThrow(
      db,
      conversationId,
      tabId,
      messageId,
      moneyRecordId,
      accountId,
      orgId,
      {
        membership: { select: { conversation: { select: { baseCurrency: true, lastActiveAccounts: true } } } },
        message: { select: MESSAGE_SELECT },
        moneyRecord: { select: MONEY_RECORD_SELECT_NO_PARTAKERS }
      }
    )
    const { conversation } = membership

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

    const lastActiveAccountSet = new Set(conversation.lastActiveAccounts?.split(','))
    lastActiveAccountSet.add(accountId)
    const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

    const convoUpdate = db.conversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date(), lastActiveAccounts }
    })
    calls.push(convoUpdate)

    const logInsert = db.activityLog.create({
      data: {
        objectType: $Enums.ActivityLogObjectType.conversation,
        objectId: conversationId,
        type: ActivityLogType.moneyRecord_update,
        details: data,
        detailsVersion: '1.0.0',
        createdBy: accountId
      }
    })
    calls.push(logInsert)

    const res = await db.$transaction(calls)

    await calculateTabSettlement(accountId, db, conversationId, conversation, tabId)

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

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, conversationId, {
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
        money_record_id: moneyRecord.id,
        message: wsMessage,
        sent_to: Array.from(sentTo)
      } satisfies WsUpdateMoneyRecordReceipt
    }
    ws.send(JSON.stringify(payload))

    return {
      upserted: res.slice(0, upserts.length),
      updated: res.slice(upserts.length, res.length - 2)
    }
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpsertMoneyRecordPartakers ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        conversation_id: conversationId,
        tab_id: tabId,
        message_id: messageId,
        money_record_id: moneyRecordId,
        error: transformError(e)
      } satisfies WsUpdateMoneyRecordReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
