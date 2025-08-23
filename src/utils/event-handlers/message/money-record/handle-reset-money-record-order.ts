import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { Ws_MoneyRecord_ResetOrder_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_MoneyRecord_ResetOrder_Receipt } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../../db/queries'
import { broadcastToGroupMembersExceptMe } from '../../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../../ws/transform-error'

export default async function handleResetMoneyRecordOrder(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_MoneyRecord_ResetOrder_RequestData
) {
  // Validate inputs
  const input = Ws_MoneyRecord_ResetOrder_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, tabId, data } = input

  try {
    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: { select: { lastActiveAccounts: true } } }
    })
    const { group } = membership

    return await db.$transaction(async (tx) => {
      const updateResult = await tx.$executeRaw`WITH data AS (
          SELECT
            "tabId", id,
            ROW_NUMBER() OVER(PARTITION BY "tabId" ORDER BY "createdAt") AS order
          FROM "MoneyRecord"
          WHERE "groupId" = ${groupId} AND "tabId" = ${tabId}
        )
        UPDATE "MoneyRecord"
        SET "order" = data.order
        FROM data
        WHERE "MoneyRecord"."id" = data.id;`

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
          updated: { count: updateResult },
          sent_to: Array.from(sentTo)
        } satisfies Ws_MoneyRecord_ResetOrder_Receipt as Ws_MoneyRecord_ResetOrder_Receipt
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
      } satisfies Ws_MoneyRecord_ResetOrder_Receipt as Ws_MoneyRecord_ResetOrder_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
