import { $Enums } from '@prisma/client'
import type { WebSocketServer, WebSocket } from 'ws'

import { ActivityLogType, DEFAULT_GROUP_VISIBILITY } from '@/constants/data'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import { Ws_Group_Update_RequestData } from '@/types/ws/request'
import type { WsResponseFullPayload, Ws_Group_Update_Receipt } from '@/types/ws/response'
import { findUniqueGroupMembershipOrThrow } from '@/utils/db/queries'
import { broadcastToGroupMembersExceptMe } from '@/utils/ws/broadcast-to-group-members-except-me'
import { transformError } from '@/utils/ws/transform-error'

export default async function handleUpdateGroup(
  wss: WebSocketServer,
  ws: WebSocket,
  requestId: string,
  locale: SupportedLocale,
  rawInput: Ws_Group_Update_RequestData
) {
  // Validate inputs
  const input = Ws_Group_Update_RequestData.parse(rawInput)

  const { accountId, orgId } = ws.auth
  const { groupId, data } = input
  const { name, description, photo, visibility, defaultCurrency, note } = data

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
            defaultCurrency,
            note,
            updatedBy: accountId,
            lastActivityAt: new Date(),
            lastActiveAccounts
          },
          select: {
            id: true,
            name: name !== undefined,
            description: description !== undefined,
            photo: photo !== undefined,
            visibility: visibility !== undefined,
            defaultCurrency: defaultCurrency !== undefined,
            note: note !== undefined,
            tabs: defaultCurrency != undefined
          }
        })

        updatedGroup = {
          ...updatedGroup,
          photo: photo === undefined ? undefined : '<updated>',
          visibility: visibility === undefined ? undefined : (updatedGroup.visibility ?? DEFAULT_GROUP_VISIBILITY)
        }
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

      let sentTo = null
      if (updatedGroup) {
        sentTo = await broadcastToGroupMembersExceptMe(wss, ws, tx, accountId, orgId, groupId, {
          event: 'group--updated',
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
        } satisfies Ws_Group_Update_Receipt
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
      } satisfies Ws_Group_Update_Receipt
    }
    ws.send(JSON.stringify(payload))
  }
}
