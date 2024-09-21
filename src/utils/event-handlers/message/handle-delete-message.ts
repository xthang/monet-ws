import { ActivityLogObjectType } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import { FILE_SERVICE_SYSTEM_SYNC_API_KEY, FILE_SERVICE_URL } from '@/constants/env'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
import type { Ws_Message_Delete_RequestData } from '@/types/ws/request'
import type { Ws_Message_Delete_Receipt, WsResponseFullPayload } from '@/types/ws/response'

import calculateTabSettlement from '../../db/calculate-group-tab-settlement'
import { findUniqueGroupMembershipOrThrow } from '../../db/queries'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export default async function handleDeleteMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  message: Ws_Message_Delete_RequestData
) {
  const { accountId, orgId } = ws.auth
  const { groupId, tabId, id: messageId } = message

  try {
    // check permission
    const { group } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    const deleted = await db.$transaction(async (tx) => {
      const deleted = await tx.message.softDelete({
        tx,
        where: { id: messageId, groupId, tabId },
        deletedBy: accountId,
        select: {
          id: true,
          groupId: true,
          tabId: true,
          groupTab: true,
          moneyRecordId: true,
          deletedAt: true,
          deletedBy: true,
          deletedByAccount: true,
          sentAt: true,
          sentBy: true
        }
      })

      if (deleted.moneyRecordId) {
        const deletedMoneyRecord = await tx.moneyRecord.softDelete({
          tx,
          where: { id: deleted.moneyRecordId, groupId_messageId: { groupId, messageId } },
          deletedBy: accountId
        })

        if (deletedMoneyRecord) {
          await calculateTabSettlement(accountId, tx, groupId, deleted.tabId, (deleted as any).groupTab)

          await tx.activityLog.create({
            data: {
              objectType: ActivityLogObjectType.group,
              objectId: groupId,
              type: ActivityLogType.moneyRecord_delete,
              details: { messageId: deleted.id, monetRecordId: deletedMoneyRecord.id },
              detailsVersion: '1.0.0',
              createdBy: accountId
            }
          })
        }

        const fileDeleteResp = await fetch(
          `${FILE_SERVICE_URL}/sync/v1/delete-money-record/${groupId}/${tabId}/${deleted.moneyRecordId}`,
          {
            method: 'DELETE',
            headers: { 'x-api-key': FILE_SERVICE_SYSTEM_SYNC_API_KEY }
          }
        )
        const fileDeleteRespStatus = fileDeleteResp.status
        if (fileDeleteRespStatus !== 200)
          throw new WsError(WsHttpCode.INTERNAL_SERVER_ERROR, WsErrorCode.FILE_DELETE_ERROR, 'File delete error')
      }

      await tx.groupTab.update({ where: { id: tabId }, data: { lastActivityAt: new Date() } })

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      return deleted
    })

    // BROADCAST ...

    const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, db, accountId, orgId, groupId, {
      event: 'message--deleted',
      orgId,
      data: deleted
    })

    // send receipt back to itself
    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        message_id: messageId,
        message: deleted,
        sent_to: Array.from(sentTo)
      } satisfies Ws_Message_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleDeleteMessage | input:`, message, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        message_id: messageId,
        error: transformError(e)
      } satisfies Ws_Message_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
