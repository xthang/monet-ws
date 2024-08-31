import type { Group, Message, MoneyRecord, MoneyRecordPartaker } from '@prisma/client'

import type { AccountBasicInfo } from '../db/index'
import type { ParticipantMember } from '../participant-member'

import type { Ws_GroupTab_Update_RequestData } from './request'

type WsMessageFullPayload = WsMessagePayload & {}

type WsMessagePayload =
  | {
      event: 'error'
      data: { code: string; message: string; details?: any }
    }
  | {
      event: 'notification'
      data: WsNotification
    }
  | {
      event: 'group--updated'
      orgId: string | undefined
      data: { group: WsGroup }
    }
  | {
      event: 'group--deleted'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'group-members--upserted'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'group-membership-request--new' | 'group-membership-request--canceled'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'group-membership-request--action'
      orgId: string | undefined
      data: { groupId: string; action: 'approve' | 'reject' }
    }
  | {
      event: 'group-tab--created' | 'group-tab--deleted'
      orgId: string | undefined
      data: { groupId: string; tabId: string }
    }
  | {
      event: 'group-tab--updated'
      orgId: string | undefined
      data: { groupId: string; tabId: string; data: Ws_GroupTab_Update_RequestData['data'] }
    }
  | {
      event: 'message--text--new'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'message--updated'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'message--deleted'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'money-record--updated'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }
  | {
      event: 'money-record--expense-docs--upserted'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }
  | {
      event: 'payable-settlement--new'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }

type WsNotification = any

type WsGroup = RequiredNonNullableProps<Omit<Group, 'no'>, 'visibility'>

type WsChatMessage = Omit<Message, 'no' | 'uiId'> & {
  moneyRecord?: WsMoneyRecord | null
  deletedByAccount?: AccountBasicInfo | null
}

type WsMoneyRecord = Omit<MoneyRecord, 'no' | 'amount' | 'rate' | 'amountPerPartaker'> & {
  amount: number | null
  rate: number | null
  amountPerPartaker: number | null
  payerMember: ParticipantMember
  partakers: {
    [memberId: string]: Pick<MoneyRecordPartaker, 'id'> & {
      member: ParticipantMember
      proportion: number | null
    }
  }
  expenseDocuments: Pick<ExpenseDocument, 'id' | 'fileName'>[]
}
