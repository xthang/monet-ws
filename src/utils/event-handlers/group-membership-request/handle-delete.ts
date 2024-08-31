import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import type { Locale } from '@/constants/locales'
import db from '@/db'
import { WsError, WsErrorCode, WsHttpCode } from '@/types/error'
import { Ws_GroupMembershipRequest_Delete_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_GroupMembershipRequest_Delete_Receipt } from '@/types/ws/response'
import { findGroupOrThrowAndGroupMembership, findUniqueAccountOrThrow } from '@/utils/db/queries'
import { MEMBER_SELECT_FOR_NOTIFY } from '@/utils/db/query-constants'
import { fromDbLocale } from '@/utils/db/transform/locale'
import { getMemberName } from '@/utils/get-name-display'
import getNotificationRecipientInfoFromMembership from '@/utils/notify/get-notification-recipient-info-from-membership'
import notifyCanceledGroupMembershipRequest from '@/utils/notify/group-membership-request/notify-canceled-group-membership-request'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleDeleteGroupMembershipRequest(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: Ws_GroupMembershipRequest_Delete_RequestData
) {
  // Validate inputs
  const input = Ws_GroupMembershipRequest_Delete_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId } = input

  try {
    const account = await findUniqueAccountOrThrow(db, accountId)

    // validate
    const [{ memberships: adminMemberships, ...group }, membership] = await findGroupOrThrowAndGroupMembership(
      db,
      groupId,
      accountId,
      orgId,
      {
        group: {
          select: {
            id: true,
            name: true,
            visibility: true,
            memberships: {
              where: {
                role: { in: [$Enums.GroupMemberRole.admin, $Enums.GroupMemberRole.mod] },
                deletedAt: null,
                deletedBy: null,
                isActive: true
              },
              select: MEMBER_SELECT_FOR_NOTIFY
            }
          }
        }
      }
    )

    if (membership) throw new WsError(WsHttpCode.BAD_REQUEST, null, 'Already a member')
    if (group.visibility === $Enums.GroupVisibility.secret)
      throw new WsError(WsHttpCode.BAD_REQUEST, WsErrorCode.GROUP_NOT_FOUND, 'Group not found')

    return await db.$transaction(async (tx) => {
      await tx.groupMembershipRequest.softDelete({
        where: { groupId_accountId_isActive: { groupId, accountId, isActive: true } },
        deletedBy: accountId
      })

      const toSendNoti: {
        accountId?: string
        accountAliasId?: string
        name?: string
        locale?: Locale | null
        channel: 'email' | 'sms'
        address: string
      }[] = adminMemberships.flatMap((m) =>
        getNotificationRecipientInfoFromMembership(
          { ...m, account: { ...m.account!, locale: m.account!.locale && fromDbLocale(m.account!.locale) } },
          locale
        )
      )

      // queue Email/SMS
      await notifyCanceledGroupMembershipRequest(
        group,
        toSendNoti,
        { account: { name: getMemberName({ account }) ?? '[no name]' } },
        tx
      )

      // BROADCAST ...

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'group-membership-request--canceled',
        orgId,
        data: { groupId: group.id }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          sent_to: Array.from(sentTo)
        } satisfies Ws_GroupMembershipRequest_Delete_Receipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleDeleteGroupMembershipRequest | input:`, input, `| ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        error: transformError(e)
      } satisfies Ws_GroupMembershipRequest_Delete_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
