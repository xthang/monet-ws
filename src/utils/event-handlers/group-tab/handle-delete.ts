import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import { FILE_SERVICE_SYSTEM_SYNC_API_KEY, FILE_SERVICE_URL } from '@/constants/env'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
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

      const fileDeleteResp = await fetch(`${FILE_SERVICE_URL}/sync/v1/delete-group-tab/${groupId}/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': FILE_SERVICE_SYSTEM_SYNC_API_KEY }
      })
      const fileDeleteRespStatus = fileDeleteResp.status
      if (fileDeleteRespStatus !== 200) {
        throw new WsError(WsHttpCode.INTERNAL_SERVER_ERROR, WsErrorCode.FILE_DELETE_ERROR, 'File delete error')
      }

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
