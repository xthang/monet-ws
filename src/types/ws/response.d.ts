import type { WsChatMessage, WsConversation } from './message.d'

type WsResponseFullPayload = WsResponsePayload & {}

type WsResponsePayload = {
  event: 'callback'
  requestId: string
  data?: WsResponseData
  error?: WsErrorData
}

type WsErrorData = { code: string; message: string; details?: any }

type WsResponseData =
  | WsUpdateConversationReceipt
  | WsDeleteConversationReceipt
  | WsChatMessageReceipt
  | WsUpdateChatMessageReceipt
  | WsUpdateMoneyRecordReceipt
  | WsDeleteMessageReceipt
  | WsSettleUpPayableReceipt

type WsUpdateConversationReceipt = {
  conversation_id: string
  conversation?: WsConversation
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsDeleteConversationReceipt = {
  conversation_id: string
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsChatMessageReceipt = {
  conversation_id: string
  tab_id: string
  ui_id: string
  message?: WsChatMessage & { uiId: string }
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
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsDeleteMessageReceipt = {
  conversation_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}

type WsSettleUpPayableReceipt = {
  conversation_id: string
  tab_id: string
  settlement_id: string
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: { code: string; message: string; details?: any }
}
