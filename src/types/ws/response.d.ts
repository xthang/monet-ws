import type { WsChatMessage } from './message.js'

type WsResponseFullPayload = WsResponsePayload & {}

type WsResponsePayload = {
  event: 'callback'
  requestId: string
  data?: WsResponseData
  error?: WsErrorData
}

type WsErrorData = { code: string; message: string; details?: any }

type WsResponseData = WsChatMessageReceipt | WsUpdateChatMessageReceipt | WsUpdateMoneyRecordReceipt

type WsChatMessageReceipt = {
  conversation_id: string
  tab_id: string
  ui_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsUpdateChatMessageReceipt = {
  conversation_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsUpdateMoneyRecordReceipt = {
  conversation_id: string
  tab_id: string
  message_id: string
  money_record_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}
