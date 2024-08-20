import { $Enums } from '@prisma/client'
import { z } from 'zod'

import type { Locale } from '@/constants/locales.ts'

export type Auth = {
  accountId: string
  authAccountId: string
  orgId?: string

  locale: Locale | null
}

export type WsRequestFullPayload = { requestId: string; token: string; locale: Locale } & WsRequestData

export type WsRequestData =
  | {
      event: 'new-text-message'
      data: WsSendMessageRequestData
    }
  | {
      event: 'update-mgs'
      data: unknown
    }
  | {
      event: 'new-money-record'
      data: WsCreateMoneyRecordRequestData
    }
  | {
      event: 'update-money-record'
      data: WsUpdateMoneyRecordRequestData
    }
  | {
      event: 'upsert-money-record-partakers'
      data: WsUpsertMoneyRecordPartakersRequestData
    }
  | {
      event: 'delete-message'
      data: WsDeleteMessageRequestData
    }
  | {
      event: 'settle-up-payable'
      data: WsSettleUpPayableRequestData
    }

export type WsSendMessageRequestData = {
  conversationId: string
  tabId: string
  uiId: string
  text: string
  sentAt: Date
}

export const WsCreateMoneyRecordRequestData = z.object({
  conversationId: z.string(),
  tabId: z.string(),
  data: z.object({
    uiId: z.string(),
    time: z.coerce.date().nullable().optional(),
    type: z.nativeEnum($Enums.MoneyRecordType).optional(),
    description: z.string(),
    note: z.string().nullable().optional(),
    payerMemberId: z.string(),
    amount: z.number().nullable().optional(),
    currency: z.nativeEnum($Enums.Currency),
    rate: z.number().nullable().optional(),
    ratePerBase: z.boolean().nullable().optional(),
    amountPerPartaker: z.number().nullable().optional(),
    sentAt: z.coerce.date()
  })
})

export type WsCreateMoneyRecordRequestData = z.infer<typeof WsCreateMoneyRecordRequestData>

export const WsUpdateMoneyRecordRequestData = z.object({
  conversationId: z.string(),
  tabId: z.string(),
  data: z.object({
    id: z.string(),
    messageId: z.string(),
    time: z.coerce.date().nullable().optional(),
    description: z.string().optional(),
    note: z.string().nullable().optional(),
    payerMemberId: z.string().optional(),
    amount: z.number().nullable().optional(),
    currency: z.nativeEnum($Enums.Currency).optional(),
    ratePerBase: z.boolean().nullable().optional(),
    rate: z.number().nullable().optional(),
    amountPerPartaker: z.number().nullable().optional()
  })
})

export type WsUpdateMoneyRecordRequestData = z.infer<typeof WsUpdateMoneyRecordRequestData>

export const WsUpsertMoneyRecordPartakersRequestData = z.object({
  conversationId: z.string(),
  tabId: z.string(),
  messageId: z.string(),
  moneyRecordId: z.string(),
  data: z.array(
    z.union([
      z.object({
        id: z.string(),
        memberId: z.string(),
        proportion: z.number().nullable().optional()
      }),
      z.object({
        memberId: z.string(),
        proportion: z.number()
      })
    ])
  )
})

export type WsUpsertMoneyRecordPartakersRequestData = z.infer<typeof WsUpsertMoneyRecordPartakersRequestData>

export const WsDeleteMessageRequestData = z.object({
  conversationId: z.string(),
  tabId: z.string(),
  id: z.string()
})

export type WsDeleteMessageRequestData = z.infer<typeof WsDeleteMessageRequestData>

export const WsSettleUpPayableRequestData = z.object({
  conversationId: z.string(),
  tabId: z.string(),
  settlementId: z.string(),
  description: z.string().optional()
})

export type WsSettleUpPayableRequestData = z.infer<typeof WsSettleUpPayableRequestData>
