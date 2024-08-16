import type { ClientRequest, IncomingMessage } from 'node:http'

// eslint-disable-next-line import/no-unassigned-import
import 'ws'
import type { RawData } from 'ws'

import type { Auth } from './request.js'

declare module 'ws' {
  declare interface WebSocket {
    isAlive: boolean
    auth: Auth

    // Events
    on(event: 'close', listener: (this: WebSocket, code: number, reason: Buffer) => void): this
    on(event: 'error', listener: (this: WebSocket, err: Error) => void): this
    on(event: 'upgrade', listener: (this: WebSocket, request: IncomingMessage) => void): this
    on(event: 'message', listener: (this: WebSocket, data: RawData, isBinary: boolean) => void): this
    on(event: 'open', listener: (this: WebSocket) => void): this
    on(event: 'ping' | 'pong', listener: (this: WebSocket, data: Buffer) => void): this
    on(event: 'unexpected-response', listener: (this: WebSocket, request: ClientRequest, response: IncomingMessage) => void): this
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
