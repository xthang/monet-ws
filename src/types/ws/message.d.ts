import type { Conversation, Message, MoneyRecord, MoneyRecordPartaker } from '@prisma/client'

import type { AccountBasicInfo } from '../db/index'
import type { ParticipantMember } from '../participant-member'

type WsMessageFullPayload = WsMessagePayload & {}

type WsMessagePayload =
  | {
      event: 'notification'
      data: WsNotification
    }
  | {
      event: 'error'
      data: { code: string; message: string; details?: any }
    }
  | {
      event: 'updated-conversation'
      orgId: string | undefined
      data: { conversation: WsConversation }
    }
  | {
      event: 'deleted-conversation'
      orgId: string | undefined
      data: { conversationId: string }
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
      event: 'new-payable-settlement'
      orgId: string | undefined
      data: RequiredProps<WsChatMessage, 'moneyRecord'>
    }

type WsNotification = any

type WsConversation = Conversation

type WsChatMessage = Omit<Message, 'uiId'> & {
  moneyRecord?: WsMoneyRecord | null
  deletedByAccount?: AccountBasicInfo | null
}

type WsMoneyRecord = Omit<MoneyRecord, 'amount' | 'rate' | 'amountPerPartaker'> & {
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
}
