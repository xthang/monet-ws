import { WebSocketServer, type WebSocket } from 'ws'

import { PORT } from './constants/env'
import { Locale } from './constants/locales'
import db from './db/index'
import { verifyToken } from './security/token-verification'
import { WsError, WsErrorCode } from './types/error'
import type { WsMessageFullPayload } from './types/ws/message.d'
import type { WsRequestFullPayload } from './types/ws/request'
import type { WsResponseFullPayload } from './types/ws/response.d'
import { findUniqueAccountByAuthAccIdOrThrow } from './utils/db/index'
import handleDeleteGroup from './utils/event-handlers/group/handle-delete-group'
import handleUpdateGroup from './utils/event-handlers/group/handle-update-group'
import handleUpsertGroupMember from './utils/event-handlers/group-members/handle-upsert-group-members'
import handleDeleteMessage from './utils/event-handlers/message/handle-delete-message'
import handleNewMessage from './utils/event-handlers/message/handle-new-message'
import handleUpsertMoneyRecordPartakers from './utils/event-handlers/message/money-record/handle-bunk-upsert-money-record-partakers'
import handleCreateMoneyRecord from './utils/event-handlers/message/money-record/handle-new-money-record'
import handleSettleUpPayable from './utils/event-handlers/message/money-record/handle-settle-up-payable'
import handleUpdateMoneyRecord from './utils/event-handlers/message/money-record/handle-update-money-record'
import { transformError } from './utils/ws/transform-error'

import './utils/polyfills/console'
import './utils/polyfills/Date'

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
        request.destroy(new WsError(WsErrorCode.NOT_AUTHENTICATED, 'Not authenticated'))
        return
      }

      const auth = verifyToken(token)
      if (!auth) {
        console.warn(`<-> WSS on.connection:`, request.method, maskedUrl, 'Not authenticated')
        ws.terminate()
        request.destroy(new WsError(WsErrorCode.NOT_AUTHENTICATED, 'Not authenticated'))
        return
      }

      ws.isAlive = true

      const { id: accountId, locale: accountLocale } = await findUniqueAccountByAuthAccIdOrThrow(db, auth.userId)

      ws.auth = {
        accountId,
        authAccountId: auth.userId,
        orgId: auth.ordId,
        locale: (accountLocale?.replaceAll('_', '-') ?? null) as Locale | null
      }

      console.log(`<-> WSS on.connection:`, request.method, maskedUrl, `[${accountId}-${auth.userId}-${auth.ordId}]`)

      if (!wss.socketsByAccount[accountId]) wss.socketsByAccount[accountId] = { clients: new Set([ws]) }
      else wss.socketsByAccount[accountId].clients.add(ws)

      ws.on('ping', function (data) {
        console.dev(`<-- WS [${this.auth.accountId}] on.ping:`, data.toString())
      })
      ws.on('pong', function (data) {
        console.dev(`<-- WS [${this.auth.accountId}] on.pong:`, data.toString())
        this.isAlive = true
      })

      ws.on('upgrade', function (request) {
        console.log(`--  WS [${this.auth.accountId}] on.upgrade:`, request.method)
      })

      ws.on('open', function () {
        console.log(`<-> WS [${this.auth.accountId}] on.open`)
      })

      ws.on('message', async function message(rawData, _isBinary) {
        try {
          const { requestId, token, locale, event, data, ..._otherData } = JSON.parse(
            rawData.toString()
          ) as WsRequestFullPayload

          try {
            console.log(`<-- WS [${this.auth.accountId}] received: [%s] [%s]`, requestId, event, _otherData)

            const auth = verifyToken(token)
            if (!auth) {
              console.warn(`<-- WS [${this.auth.accountId}] received: Not authenticated`)
              return
            }

            this.auth = { accountId, authAccountId: auth.userId, orgId: auth.ordId, locale: this.auth.locale }

            switch (event) {
              case 'update-group':
                await handleUpdateGroup(wss, this, requestId, locale, data)
                break
              case 'delete-group':
                await handleDeleteGroup(wss, this, requestId, locale, data)
                break
              case 'upsert-group-members':
                await handleUpsertGroupMember(wss, this, requestId, locale, data)
                break
              case 'new-text-message':
                await handleNewMessage(wss, this, requestId, locale, {
                  ...data,
                  sentAt: new Date(Date.parse(data.sentAt as any))
                })
                break
              case 'new-money-record':
                await handleCreateMoneyRecord(wss, this, requestId, locale, data)
                break
              case 'update-money-record':
                await handleUpdateMoneyRecord(wss, this, requestId, locale, data)
                break
              case 'upsert-money-record-partakers':
                await handleUpsertMoneyRecordPartakers(wss, this, requestId, locale, data)
                break
              case 'delete-message':
                await handleDeleteMessage(wss, this, requestId, locale, data)
                break
              case 'settle-up-payable':
                await handleSettleUpPayable(wss, this, requestId, locale, data)
                break
              default: {
                console.warn(`<!- Unknown event:`, event)

                const payload: WsResponseFullPayload = {
                  event: 'callback',
                  requestId,
                  error: transformError(new WsError(WsErrorCode.BAD_REQUEST, `Invalid event: ${event}`))
                }
                ws.send(JSON.stringify(payload))
              }
            }
          } catch (e: any) {
            console.error(`<-- WS [${this.auth.accountId}] on.message ERROR:`, e)

            const payload: WsResponseFullPayload = { event: 'callback', requestId, error: transformError(e) }
            ws.send(JSON.stringify(payload))
          }
        } catch (e: any) {
          console.error(`<-- WS [${this.auth.accountId}] on.message ERROR:`, e)

          const payload: WsMessageFullPayload = { event: 'error', data: transformError(e) }
          ws.send(JSON.stringify(payload))
        }
      })

      ws.on('unexpected-response', function (request, response) {
        console.log(`<!- WS [${this.auth.accountId}] on.unexpected-response:`, request, response)
      })

      ws.on('close', function (code, reason) {
        console.log(`-x- WS [${this.auth.accountId}] CLOSED:`, code, '-', reason.toString())

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
