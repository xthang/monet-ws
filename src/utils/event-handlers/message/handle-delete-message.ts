import { ActivityLogObjectType } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db/index'
import type { WsDeleteMessageRequestData } from '@/types/ws/request'
import type { WsDeleteMessageReceipt, WsResponseFullPayload } from '@/types/ws/response'

import calculateTabSettlement from '../../db/calculate-group-tab-settlement'
import { findUniqueGroupMembershipOrThrow } from '../../db/index'
import { broadcastToGroupMembersExceptMe } from '../../ws/broadcast-to-group-members-except-me'
import { transformError } from '../../ws/transform-error'

export default async function handleDeleteMessage(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  message: WsDeleteMessageRequestData
) {
  const { accountId, orgId } = ws.auth
  const { groupId, tabId, id: messageId } = message

  try {
    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })
    const { group } = membership

    return db.$transaction(async (tx) => {
      const deleted = await tx.message.softDelete({
        tx,
        where: { id: messageId, groupId },
        deletedBy: accountId,
        select: {
          id: true,
          groupId: true,
          tabId: true,
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
          await calculateTabSettlement(accountId, tx, groupId, group, deleted.tabId)

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
      }

      const lastActiveAccountSet = new Set(group.lastActiveAccounts?.split(','))
      lastActiveAccountSet.add(accountId)
      const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

      await tx.group.update({
        where: { id: groupId },
        data: { lastActivityAt: new Date(), lastActiveAccounts }
      })

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'deleted-message',
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
        } satisfies WsDeleteMessageReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleDeleteMessage ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        tab_id: tabId,
        message_id: messageId,
        error: transformError(e)
      } satisfies WsDeleteMessageReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
