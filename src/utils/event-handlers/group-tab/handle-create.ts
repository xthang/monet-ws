import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { Ws_GroupTab_Create_RequestData } from '@/types/ws/request'
import type { Ws_GroupTab_Create_Receipt, WsResponseFullPayload } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../db/queries'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export async function handleCreateGroupTab(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_GroupTab_Create_RequestData
) {
  // Validate inputs
  const input = Ws_GroupTab_Create_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const {
    groupId,
    data: { title, color, baseCurrency, order }
  } = input

  try {
    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    const tab = await db.$transaction(async (tx) => {
      const tab = await tx.groupTab.create({
        data: { groupId, title, color, baseCurrency, order, createdBy: accountId }
      })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastTabId: tab.id, lastActivityAt: new Date(), lastActiveAccounts }
      })

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.groupTab_create,
          details: input,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      return tab
    })

    // BROADCAST ...

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'group-tab--created',
      orgId,
      data: { groupId, tabId: tab.id }
    })

    // send receipt back to itself
    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tab.id,
        sent_to: Array.from(sentTo)
      } satisfies Ws_GroupTab_Create_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleCreateGroupTab | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        error: transformError(e)
      } satisfies Ws_GroupTab_Create_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
