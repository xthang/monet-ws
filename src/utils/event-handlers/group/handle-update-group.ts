import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db/index'
import { WsUpdateGroupRequestData } from '@/types/ws/request'
import { WsResponseFullPayload, WsUpdateGroupReceipt } from '@/types/ws/response'
import { findUniqueGroupMembershipOrThrow } from '@/utils/db'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleUpdateGroup(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: Locale,
  rawInput: WsUpdateGroupRequestData
) {
  // Validate inputs
  const input = WsUpdateGroupRequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, data } = input
  const { name, description, photo, baseCurrency, note } = data

  try {
    // check permission
    const membership = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })
    const existedGroup = membership.group

    return db.$transaction(async (tx) => {
      let updatedGroup
      if (Object.entries(data).filter(([_, v]) => v !== undefined).length) {
        const lastActiveAccountSet = new Set(existedGroup.lastActiveAccounts?.split(','))
        lastActiveAccountSet.add(accountId)
        const lastActiveAccounts = Array.from(lastActiveAccountSet).slice(undefined, 4).join(',')

        updatedGroup = await tx.group.update({
          where: { id: groupId, orgId: orgId ?? null },
          data: {
            name,
            description,
            photo,
            baseCurrency,
            note,
            updatedBy: accountId,
            lastActivityAt: new Date(),
            lastActiveAccounts
          }
        })
      }

      await tx.activityLog.create({
        data: {
          objectType: $Enums.ActivityLogObjectType.group,
          objectId: groupId,
          type: ActivityLogType.group_update,
          details: input.data,
          detailsVersion: '1.0.0',
          createdBy: accountId
        }
      })

      // BROADCAST ...

      if (!updatedGroup) return

      const sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
        event: 'updated-group',
        orgId,
        data: { group: updatedGroup }
      })

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          group: updatedGroup,
          sent_to: Array.from(sentTo)
        } satisfies WsUpdateGroupReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateGroup ERROR:`, e)

    const payload: WsResponseFullPayload = {
      event: 'callback',
      requestId,
      data: {
        group_id: groupId,
        error: transformError(e)
      } satisfies WsUpdateGroupReceipt
    }
    ws.send(JSON.stringify(payload))
  }
}
