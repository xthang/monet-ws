import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { Ws_GroupTab_Update_RequestData } from '@/types/ws/request'
import type { Ws_GroupTab_Update_Receipt, WsResponseFullPayload } from '@/types/ws/response'
import calculateTabSettlement from '@/utils/db/calculate-group-tab-settlement'
import calculateMyPayables from '@/utils/db/calculate-money-record-of-mine'

import { findUniqueGroupMembershipOrThrow } from '../../db/queries'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export async function handleUpdateGroupTab(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_GroupTab_Update_RequestData
) {
  // Validate inputs
  const input = Ws_GroupTab_Update_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, data: tabs } = input

  try {
    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    await db.$transaction(async (tx) => {
      for (const { id, title, color, baseCurrency, order } of tabs)
        await tx.groupTab.update({
          where: { id, groupId },
          data: { title, color, baseCurrency, order, updatedBy: accountId, lastActivityAt: new Date() }
        })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      for (const { id, baseCurrency } of tabs)
        if (baseCurrency != undefined) await calculateTabSettlement(accountId, tx, groupId, id, { baseCurrency })

      if (tabs.some((t) => t.baseCurrency != null)) await calculateMyPayables(accountId, orgId, tx)

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.groupTab_update,
          details: input,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })
    })

    // BROADCAST ...

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'group-tab--updated',
      orgId,
      data: { groupId, data: tabs }
    })

    // send receipt back to itself
    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_ids: tabs.map((t) => t.id),
        sent_to: Array.from(sentTo)
      } satisfies Ws_GroupTab_Update_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateGroupTab | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_ids: tabs.map((t) => t.id),
        error: transformError(e)
      } satisfies Ws_GroupTab_Update_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
