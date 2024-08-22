import { type WebSocketServer, WebSocket } from 'ws'

import type { PrismaClient, PrismaTransactionClient } from '@/db/types'
import type { WsMessageFullPayload } from '@/types/ws/message'

// A client WebSocket broadcasting to every other connected WebSocket clients, excluding itself.
export async function broadcastToGroupMembersExceptMe(
  wss: WebSocketServer,
  ws: WebSocket,
  db: PrismaClient | PrismaTransactionClient,
  accountId: string,
  orgId: string | undefined,
  groupId: string,
  payload: WsMessageFullPayload
) {
  const memberships = await db.groupMembership.findMany({
    where: { groupId, AND: [{ accountId: { not: null } }, { accountId: { not: accountId } }], isActive: true },
    select: { accountId: true }
  })

  const sentTo = new Set<string>()
  for (const { accountId: mAccountId } of memberships.concat([{ accountId }])) {
    wss.socketsByAccount[mAccountId!]?.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN && client.auth.orgId == orgId) {
        client.send(JSON.stringify(payload))
        sentTo.add(mAccountId!)
      }
    })
  }

  return sentTo
}
