import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { Ws_MoneyRecord_UpdateMany_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_MoneyRecord_UpdateMany_Receipt } from '@/types/ws/response'

import { findMessagesOrThrow } from '../../../db/queries'
import { MONEY_RECORD_SELECT } from '../../../db/query-constants'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleUpdateMoneyRecords(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_MoneyRecord_UpdateMany_RequestData
) {
  // Validate inputs
  const input = Ws_MoneyRecord_UpdateMany_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, tabId, data } = input

  try {
    // check permission
    const [membership, messages] = await findMessagesOrThrow(
      db,
      groupId,
      tabId,
      data.map((it) => it.messageId),
      accountId,
      orgId,
      { membership: { select: { group: { select: { lastActiveAccounts: true } } } } },
      true
    )
    const { group } = membership

    return await db.$transaction(async (tx) => {
      const updatedMoneyRecords = []
      for (const { messageId, moneyRecordId, ...toUpdate } of data) {
        const updatedMoneyRecord = await tx.moneyRecord.update({
          where: { id: moneyRecordId, groupId, tabId, messageId },
          data: { ...toUpdate, updatedBy: accountId },
          select: {
            ...MONEY_RECORD_SELECT,
            expenseDocuments: { where: { deletedBy: null, deletedAt: null }, select: { id: true, fileName: true } }
          }
        })
        updatedMoneyRecords.push(updatedMoneyRecord)
      }

      const _tab = await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({ where: { id: groupId }, data: { lastActivityAt: new Date(), lastActiveAccounts } })

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.moneyRecord_updateMany,
          details: data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'money-record--updated-many',
        orgId,
        data: { groupId, tabId }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          tab_id: tabId,
          updated: updatedMoneyRecords.map((it) => ({ message_id: it.messageId, money_record_id: it.id })),
          sent_to: Array.from(sentTo)
        } satisfies Ws_MoneyRecord_UpdateMany_Receipt as Ws_MoneyRecord_UpdateMany_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateMoneyRecord | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        error: transformError(e)
      } satisfies Ws_MoneyRecord_UpdateMany_Receipt as Ws_MoneyRecord_UpdateMany_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
