import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { FILE_SERVICE_SYSTEM_SYNC_API_KEY, FILE_SERVICE_URL } from '@/constants/env'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
import { Ws_Group_Delete_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_Group_Delete_Receipt } from '@/types/ws/response'
import { findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
import { ACCOUNT_SELECT } from '@/utils/db/query-constants'
import { fromDbLocale } from '@/utils/db/transform/locale'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyDeletedGroup from '@/utils/notify/group/notify-deleted-group'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleDeleteGroup(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: Ws_Group_Delete_RequestData
) {
  // Validate inputs
  const groupId = Ws_Group_Delete_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth

  try {
    // Check member permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId)
    if (membership.role !== $Enums.GroupMemberRole.admin)
      throw new WsError(WsHttpCode.FORBIDDEN, WsErrorCode.NOT_ALLOWED, 'Forbidden')

    return await db.$transaction(async (tx) => {
      const memberships = await tx.groupMembership.findMany({
        where: { groupId, accountId: { not: accountId }, isActive: true },
        select: {
          accountId: true,
          accountAliasId: true,
          account: {
            where: { deletedAt: null, isActive: true },
            select: {
              ...ACCOUNT_SELECT,
              locale: true,
              accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
            }
          },
          accountAlias: { where: { deletedAt: null, isActive: true } } // verificationStatus: 'verified'
        }
      })

      const deletedGroup = await tx.group.softDelete({
        tx,
        where: { id: groupId },
        deletedBy: accountId
      })

      const fileDeleteResp = await fetch(`${FILE_SERVICE_URL}/sync/v1/delete-group/${groupId}`, {
        method: 'DELETE',
        headers: { 'api-key': FILE_SERVICE_SYSTEM_SYNC_API_KEY }
      })
      const fileDeleteRespStatus = fileDeleteResp.status
      if (fileDeleteRespStatus !== 200) {
        throw new WsError(WsHttpCode.INTERNAL_SERVER_ERROR, WsErrorCode.FILE_DELETE_ERROR, 'File delete error')
      }

      // queue Email/SMS
      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: Locale | null
        channel: 'email' | 'sms'
        address: string
      }[] = []
      for (const membership of memberships) {
        const membershipForNotify = {
          ...membership,
          account: membership.account && {
            ...membership.account,
            locale: membership.account.locale && fromDbLocale(membership.account.locale)
          }
        }

        toSendNoti.push(...getNotificationRecipientInfoFromMembership(membershipForNotify, locale))
      }
      await notifyDeletedGroup(deletedGroup, toSendNoti, tx)

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'group--deleted',
        orgId,
        data: { groupId: deletedGroup.id }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: { group_id: groupId, sent_to: Array.from(sentTo) } satisfies Ws_Group_Delete_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateGroup | input:`, rawInput, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        error: transformError(e)
      } satisfies Ws_Group_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
