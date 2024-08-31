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
  | Ws_Group_Update_Receipt
  | Ws_Group_Delete_Receipt
  | Ws_GroupMembers_Upsert_Receipt
  | Ws_GroupMembershipRequest_Create_Receipt
  | Ws_GroupMembershipRequest_Delete_Receipt
  | Ws_GroupMembershipRequest_Action_Receipt
  | Ws_GroupTab_Create_Receipt
  | Ws_GroupTab_Update_Receipt
  | Ws_GroupTab_Delete_Receipt
  | Ws_Message_Send_Receipt
  | Ws_Message_Update_Receipt
  | Ws_Message_Delete_Receipt
  | Ws_MoneyRecord_Update_Receipt
  | Ws_Payable_SettleUp_Receipt

type Ws_Group_Update_Receipt = {
  group_id: string
  group?: WsGroup
  sent_to?: string[] | null
  error?: WsErrorData
}

type Ws_Group_Delete_Receipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupMembers_Upsert_Receipt = {
  group_id: string
  members?: {
    createds?: GetBatchResult
    updateds?: GroupMembership[] | undefined
    deleteds?: GetBatchResult
  }
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupMembershipRequest_Create_Receipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupMembershipRequest_Delete_Receipt = {
  group_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupMembershipRequest_Action_Receipt = {
  group_id: string
  request_id: string
  account_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupTab_Create_Receipt = {
  group_id: string
  tab_id?: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupTab_Update_Receipt = {
  group_id: string
  tab_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_GroupTab_Delete_Receipt = {
  group_id: string
  tab_id: string
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_Message_Send_Receipt = {
  group_id: string
  tab_id: string
  ui_id: string
  message?: WsChatMessage & { uiId: string }
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_Message_Update_Receipt = {
  group_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_Message_Delete_Receipt = {
  group_id: string
  tab_id: string
  message_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_MoneyRecord_Update_Receipt = {
  group_id: string
  tab_id: string
  message_id: string
  money_record_id: string
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_MoneyRecord_ExpenseDocuments_Upsert_Receipt = {
  group_id: string
  tab_id: string
  message_id: string
  money_record_id: string
  message?: WsChatMessage
  sent_to?: string[]
  error?: WsErrorData
}

type Ws_Payable_SettleUp_Receipt = {
  group_id: string
  tab_id: string
  settlement_id: string
  message?: RequiredProps<WsChatMessage, 'moneyRecord'>
  sent_to?: string[]
  error?: WsErrorData
}
