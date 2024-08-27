import type { GetBatchResult } from '@prisma/client/runtime/library'

import type { WsChatMessage, WsGroup } from './message.d'

type WsResponseFullPayload = WsResponsePayload & {}

type WsResponsePayload = {
  event: 'callback'
  requestId: string
  data?: WsResponseData
  error?: WsErrorData
}

type WsErrorData = { code: string; message: string; details?: any }

type WsResponseData =
  | WsUpdateGroupReceipt
  | WsDeleteGroupReceipt
  | WsUpsertGroupMembersReceipt
  | WsCreateGroupMembershipRequestReceipt
  | WsDeleteGroupMembershipRequestReceipt
  | WsChatMessageReceipt
  | WsUpdateChatMessageReceipt
  | WsUpdateMoneyRecordReceipt
  | WsDeleteMessageReceipt
  | WsSettleUpPayableReceipt

type WsUpdateGroupReceipt = {
  group_id: string
  group?: WsGroup
  sent_to?: string[] | null
  error?: WsErrorData
}

type WsDeleteGroupReceipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type WsUpsertGroupMembersReceipt = {
  group_id: string
  members?: {
    createds?: GetBatchResult
    updateds?: GroupMembership[] | undefined
    deleteds?: GetBatchResult
  }
  sent_to?: string[]
  error?: WsErrorData
}

type WsCreateGroupMembershipRequestReceipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type WsDeleteGroupMembershipRequestReceipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type WsChatMessageReceipt = {
  group_id: string
  tab_id: string
  ui_id: string
  message?: WsChatMessage & { uiId: string }
  sent_to?: string[]
  error?: WsErrorData
}

type WsUpdateChatMessageReceipt = {
  group_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: WsErrorData
}

type WsUpdateMoneyRecordReceipt = {
  group_id: string
  tab_id: string
  message_id: string
  money_record_id: string
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: WsErrorData
}

type WsDeleteMessageReceipt = {
  group_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: WsErrorData
}

type WsSettleUpPayableReceipt = {
  group_id: string
  tab_id: string
  settlement_id: string
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: WsErrorData
}
