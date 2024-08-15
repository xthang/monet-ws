// eslint-disable-next-line import/no-unassigned-import
import 'ws'

import type { Auth } from './request.js'

declare module 'ws' {
  declare interface WebSocket {
    isAlive: boolean
    auth: Auth

    on(event: string | symbol, listener: (this: WebSocket, ...args: any[]) => void): this
  }

  type AccountData = {
    clients: Set<WebSocket>
  }

  declare interface WebSocketServer {
    clients: Set<WebSocket>
    socketsByAccount: { [accountId: string]: AccountData }
  }
}
