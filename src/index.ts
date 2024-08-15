import { WebSocketServer, type WebSocket } from 'ws'

import { PORT } from './constants/env.js'
import db from './db/index.js'
import { findUniqueAccountByAuthAccIdOrThrow } from './db/utils/index.js'
import { verifyToken } from './security/token-verification.js'
import { ApiError, ApiErrorCode } from './types/error.js'
import type { WsRequestFullPayload } from './types/ws/request.js'
import handleNewMessage from './utils/event-handlers/handle-new-message.js'

import './utils/polyfills/console.js'

const TAG = '🟢'

console.log(TAG, '------- STARING ...')

process
  .on('SIGINT', (signals) => {
    console.log('~~~~~~~ on.SIGINT:', signals)
    process.exit(-2)
  })
  .on('beforeExit', (code) => {
    console.log('~~~~~~~ beforeExit:', code)
  })
  .on('exit', async (code) => {
    await console.logAndSendAsync('~~~~~~~ exit:', code)
  })

process
  .on('uncaughtException', (err) => {
    console.error(`!!- process.on.uncaughtException:`, err)
  })
  .on('unhandledRejection', (reason, _promise) => {
    console.error(`!!- process.on.unhandledRejection:`, reason)
  })

async function main() {
  try {
    const wss = new WebSocketServer({ port: PORT }) as WebSocketServer
    wss.socketsByAccount = {}

    wss.on('listening', () => console.log(`--  WSS is listening on port ${PORT} ...`))

    wss.on('headers', (headers) => console.debug(`--  WSS on.headers:`, headers))

    wss.on('connection', async function connection(ws: WebSocket, request) {
      const url = new URL(`http://${process.env.HOST ?? 'localhost'}${request.url}`)
      const maskedUrl = request.url?.replaceAll(/(?=.)token=.*?(?=&|$)/gi, 'token=...')

      const token = url.searchParams.get('token')
      if (!token) {
        console.warn(`<-> WSS on.connection:`, request.method, maskedUrl, 'Not authenticated')
        ws.terminate()
        request.destroy(new ApiError(ApiErrorCode.NOT_AUTHENTICATED, 'Not authenticated'))
        return
      }

      const auth = verifyToken(token)
      if (!auth) {
        console.warn(`<-> WSS on.connection:`, request.method, maskedUrl, 'Not authenticated')
        ws.terminate()
        request.destroy(new ApiError(ApiErrorCode.NOT_AUTHENTICATED, 'Not authenticated'))
        return
      }

      const { id: accountId } = await findUniqueAccountByAuthAccIdOrThrow(db, auth.userId)

      ws.auth = { accountId, authAccountId: auth.userId, orgId: auth.ordId }

      console.log(`<-> WSS on.connection:`, request.method, maskedUrl, `[${auth.userId}]`)

      if (!wss.socketsByAccount[accountId]) wss.socketsByAccount[accountId] = { clients: new Set([ws]) }
      else wss.socketsByAccount[accountId].clients.add(ws)

      ws.on('ping', function (data) {
        console.dev(`<-- WS [${this.auth.accountId}] on.ping:`, data)
      })
      ws.on('pong', function (data) {
        console.dev(`<-- WS [${this.auth.accountId}] on.pong:`, data)
        this.isAlive = true
      })

      ws.on('upgrade', function (request) {
        console.log(`--  WS [${this.auth.accountId}] on.upgrade:`, request.method)
      })

      ws.on('open', function () {
        console.log(`<-> WS [${this.auth.accountId}] on.open`)
      })

      ws.on('message', async function message(rawData, _isBinary) {
        const { id: requestId, token, locale, event, data, ..._otherData } = JSON.parse(rawData.toString()) as WsRequestFullPayload

        console.log(`<-- WS [${this.auth.accountId}] received: [%s] [%s]`, requestId, event, _otherData)

        const user = verifyToken(token)
        if (!user) {
          console.warn(`<-- WS [${this.auth.accountId}] received: Not authenticated`)
          return
        }

        switch (event) {
          case 'send-msg':
            await handleNewMessage(wss, ws, locale, { ...data, sentAt: new Date(Date.parse(data.sentAt as unknown as string)) })
            break
          default:
            console.warn(`<!- Unknown event:`, event)
        }
      })

      ws.on('unexpected-response', function (request, response) {
        console.log(`<!- WS [${this.auth.accountId}] on.unexpected-response:`, request, response)
      })

      ws.on('close', function (code, reason) {
        console.log(`-x- WS [${this.auth.accountId}] CLOSED:`, code, '-', reason)

        wss.socketsByAccount[accountId].clients.delete(this)
        if (!wss.socketsByAccount[accountId].clients.size) delete wss.socketsByAccount[accountId]
      })

      ws.on('error', function (e) {
        console.error(`!-- WS [${this.auth.accountId}] ERROR:`, e)
      })
    })

    wss.on('close', () => console.log(`-x- WSS CLOSED`))

    wss.on('error', (e) => console.error(`!-- WSS ERROR:`, e))

    const _interval = setInterval(function ping() {
      wss.clients.forEach(function (ws) {
        if (ws.isAlive === false) return ws.terminate()

        ws.isAlive = false
        ws.ping()
      })
    }, 30000)
  } catch (err) {
    await console.errorAsync(TAG, `!!- ERROR:`, err)

    // process.exit(-99)
  } finally {
    console.log(TAG, `------- DONE`)
  }
}

main()
