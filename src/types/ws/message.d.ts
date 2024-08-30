import type { Group, Message, MoneyRecord, MoneyRecordPartaker } from '@prisma/client'

import type { AccountBasicInfo } from '../db/index'
import type { ParticipantMember } from '../participant-member'

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
      event: 'updated-group'
      orgId: string | undefined
      data: { group: WsGroup }
    }
  | {
      event: 'upserted-group-members'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'new-group-membership-request' | 'canceled-group-membership-request'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'group--membership-request--action'
      orgId: string | undefined
      data: { groupId: string; action: 'approve' | 'reject' }
    }
  | {
      event: 'deleted-group'
      orgId: string | undefined
      data: { groupId: string }
    }
  | {
      event: 'new-message'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'updated-chat-message'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'updated-money-record'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }
  | {
      event: 'deleted-message'
      orgId: string | undefined
      data: WsChatMessage
    }
  | {
      event: 'money-record--expense-docs--upserted'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }
  | {
      event: 'new-payable-settlement'
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
