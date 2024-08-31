import { $Enums } from '@prisma/client'
import { type WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType, DEFAULT_GROUP_VISIBILITY } from '@/constants/data'
import type { Locale } from '@/constants/locales'
import db from '@/db'
import { WsUpdateGroupRequestData } from '@/types/ws/request'
import { WsResponseFullPayload, WsUpdateGroupReceipt } from '@/types/ws/response'
import calculateTabSettlement from '@/utils/db/calculate-group-tab-settlement'
import { findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
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
  const { name, description, photo, visibility, baseCurrency, note } = data

  try {
    // check permission
    const { group: existedGroup } = await findUniqueGroupMembershipOrThrow(db, groupId, accountId, orgId, {
      select: { group: true }
    })

    return await db.$transaction(async (tx) => {
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
            visibility,
            baseCurrency,
            note,
            updatedBy: accountId,
            lastActivityAt: new Date(),
            lastActiveAccounts
          },
          include: { tabs: baseCurrency != undefined }
        })

        updatedGroup = { ...updatedGroup, visibility: updatedGroup.visibility ?? DEFAULT_GROUP_VISIBILITY }
      }

      if (baseCurrency != undefined)
        for (const tab of updatedGroup!.tabs)
          await calculateTabSettlement(accountId, tx, groupId, { baseCurrency }, tab.id)

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

      let sentTo = null
      if (updatedGroup) {
        sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
          event: 'updated-group',
          orgId,
          data: { group: updatedGroup }
        })
      }

      // send receipt back to itself
      const payload: WsResponseFullPayload = {
        event: 'callback',
        requestId,
        data: {
          group_id: groupId,
          group: updatedGroup,
          sent_to: sentTo && Array.from(sentTo)
        } satisfies WsUpdateGroupReceipt
      }
      ws.send(JSON.stringify(payload))
    })
  } catch (e: any) {
    console.error(`<!- WS [${accountId}] handleUpdateGroup | input:`, input, `| ERROR:`, e)

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
