import assert from 'assert'

import { WebSocketServer, type WebSocket } from 'ws'

import type { WsMessageFullPayload } from '@/types/ws/message'
import type { WsResponseFullPayload } from '@/types/ws/response'

import { PORT } from './constants/env'
// loadDbCaches must be placed after load dotenv
// eslint-disable-next-line import/order
import { loadDbCaches } from './constants/db-caches'
import type { SupportedLocale } from './constants/locales'
import db from './db/index'
import { verifyToken } from './security/token-verification'
import { WsError, WsErrorCode, WsHttpCode } from './types/error'
import type { WsRequestFullPayload } from './types/ws/request'
import { findUniqueAccountOrThrow } from './utils/db/queries'
import { fromDbLocale } from './utils/db/transform/locale'
import handleDeleteGroup from './utils/event-handlers/group/handle-delete-group'
import handleUpdateGroup from './utils/event-handlers/group/handle-update-group'
import handleUpsertGroupMembers from './utils/event-handlers/group-members/handle-upsert-group-members'
import handleGroupMembershipRequestAction from './utils/event-handlers/group-membership-request/handle-action'
import handleCreateGroupMembershipRequest from './utils/event-handlers/group-membership-request/handle-create'
import handleDeleteGroupMembershipRequest from './utils/event-handlers/group-membership-request/handle-delete'
import { handleCreateGroupTab, handleDeleteGroupTab, handleUpdateGroupTab } from './utils/event-handlers/group-tab'
import handleDeleteMessage from './utils/event-handlers/message/handle-delete-message'
import handleNewMessage from './utils/event-handlers/message/handle-new-message'
import handleUpsertMoneyRecordPartakers from './utils/event-handlers/message/money-record/handle-bunk-upsert-money-record-partakers'
import handleCreateMoneyRecord from './utils/event-handlers/message/money-record/handle-new-money-record'
import handleSettleUpPayable from './utils/event-handlers/message/money-record/handle-settle-up-payable'
import handleUpdateMoneyRecord from './utils/event-handlers/message/money-record/handle-update-money-record'
import handleUpsertExpenseDocuments from './utils/event-handlers/message/money-record/handle-upsert-expense-documents'
import { transformError } from './utils/ws/transform-error'

import './utils/polyfills/console'
import './utils/polyfills/Date'

const TAG = '🟢'

console.log(TAG, '------- STARTING ...')

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
    await loadDbCaches()

    const wss = new WebSocketServer({ port: PORT }) as WebSocketServer
    wss.socketsByAccount = {}

    wss.on('listening', () => console.log(`--  WSS is listening on port ${PORT} ...`))

    wss.on('headers', (headers) => console.debug(`--  WSS on.headers:`, headers))

    wss.on('connection', async function connection(ws: WebSocket, request) {
      const url = new URL(`http://${process.env.HOST ?? 'localhost'}${request.url}`)
      const maskedUrl = request.url?.replaceAll(/(?=.)token=.*?(?=&|$)/gi, 'token=...')

      const headers = request.headers

      const ips = []
      if (request.socket.remoteAddress) ips.push(`remote: ${request.socket.remoteAddress}`)
      if (headers['x-real-ip']) ips.push(`real-ip: ${headers['x-real-ip']}`)
      if (headers['x-forwarded-for']) ips.push(`Forwarded-For: ${headers['x-forwarded-for']}`)

      const token = url.searchParams.get('token')
      if (!token) {
        console.warn(`<-> WSS on.connection |`, ips.join(' - '), '|', request.method, maskedUrl, 'Not authenticated')
        ws.terminate()
        request.destroy(new WsError(WsHttpCode.NOT_AUTHENTICATED, null, 'Not authenticated'))
        return
      }

      const auth = verifyToken(token)
      if (!auth) {
        console.warn(`<-> WSS on.connection |`, ips.join(' - '), '|', request.method, maskedUrl, 'Not authenticated')
        ws.terminate()
        request.destroy(new WsError(WsHttpCode.NOT_AUTHENTICATED, null, 'Not authenticated'))
        return
      }

      ws.isAlive = true

      const {
        id: accountId,
        locale: accountLocale,
        ...otherAccountInfo
      } = await findUniqueAccountOrThrow(db, auth.accountId)

      ws.auth = {
        accountId,
        orgId: auth.orgId,
        locale: accountLocale && (fromDbLocale(accountLocale) as SupportedLocale),
        otherAccountInfo
      }

      console.log(
        `<-> WSS on.connection |`,
        ips.join(' - '),
        '|',
        request.method,
        maskedUrl,
        `[${accountId}-${auth.orgId}]`
      )

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
            assert(auth.accountId === this.auth.accountId, 'on.message: accountId not matched')
            // assert(auth.orgId === this.auth.orgId, 'on.message: orgId not matched')

            this.auth = { accountId, orgId: auth.orgId, locale: this.auth.locale, otherAccountInfo }

            switch (event) {
              case 'group--update':
                await handleUpdateGroup(wss, this, requestId, locale, data)
                break
              case 'group--delete':
                await handleDeleteGroup(wss, this, requestId, locale, data)
                break
              case 'group-members--upsert':
                await handleUpsertGroupMembers(wss, this, requestId, locale, data)
                break
              case 'group-membership-request--create':
                await handleCreateGroupMembershipRequest(wss, this, requestId, locale, data)
                break
              case 'group-membership-request--delete':
                await handleDeleteGroupMembershipRequest(wss, this, requestId, locale, data)
                break
              case 'group-membership-request--action':
                await handleGroupMembershipRequestAction(wss, this, requestId, locale, data)
                break
              case 'group-tab--create':
                await handleCreateGroupTab(wss, this, requestId, locale, data)
                break
              case 'group-tab--update':
                await handleUpdateGroupTab(wss, this, requestId, locale, data)
                break
              case 'group-tab--delete':
                await handleDeleteGroupTab(wss, this, requestId, locale, data)
                break
              case 'message--text--new':
                await handleNewMessage(wss, this, requestId, locale, {
                  ...data,
                  sentAt: new Date(Date.parse(data.sentAt as any))
                })
                break
              case 'message--delete':
                await handleDeleteMessage(wss, this, requestId, locale, data)
                break
              case 'money-record--new':
                await handleCreateMoneyRecord(wss, this, requestId, locale, data)
                break
              case 'money-record--update':
                await handleUpdateMoneyRecord(wss, this, requestId, locale, data)
                break
              case 'money-record-partakers--upsert':
                await handleUpsertMoneyRecordPartakers(wss, this, requestId, locale, data)
                break
              case 'money-record--expense-documents--upsert':
                await handleUpsertExpenseDocuments(wss, this, requestId, locale, data)
                break
              case 'payable--settle-up':
                await handleSettleUpPayable(wss, this, requestId, locale, data)
                break
              default: {
                console.warn(`<!- Unknown event:`, event)

                const payload: WsResponseFullPayload = {
                  event: 'callback',
                  requestId,
                  error: transformError(
                    new WsError(WsHttpCode.BAD_REQUEST, WsErrorCode.INVALID_REQUEST_EVENT, `Invalid event: ${event}`)
                  )
                }
                ws.send(JSON.stringify(payload))
              }
            }
          } catch (e: any) {
            console.error(
              `<-- WS [${this.auth.accountId}] on.message [${requestId}] | event: ${event} | data: ${data} | ERROR:`,
              e
            )

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
