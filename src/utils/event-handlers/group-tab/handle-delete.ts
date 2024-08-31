import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import { Ws_GroupTab_Delete_RequestData } from '@/types/ws/request'
import type { Ws_GroupTab_Delete_Receipt, WsResponseFullPayload } from '@/types/ws/response'

import { findUniqueGroupMembershipOrThrow } from '../../db/queries'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export async function handleDeleteGroupTab(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: Ws_GroupTab_Delete_RequestData
) {
  // Validate inputs
  const input = Ws_GroupTab_Delete_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, id } = input

  try {
    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    const tab = await db.$transaction(async (tx) => {
      const deleted = await tx.groupTab.softDelete({ tx, where: { id, groupId }, deletedBy: accountId })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.groupTab_delete,
          details: input,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      return deleted
    })

    // BROADCAST ...

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'group-tab--deleted',
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
      } satisfies Ws_GroupTab_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleDeleteGroupTab | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: id,
        error: transformError(e)
      } satisfies Ws_GroupTab_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
