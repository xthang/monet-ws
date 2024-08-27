import { $Enums } from '@prisma/client'
import { z } from 'zod'

import type { Locale } from '@/constants/locales'
import { NUMBER_TYPES } from '@/constants/phone-number'

export type Auth = {
  accountId: string
  authAccountId: string
  orgId?: string

  locale: Locale | null
}

export type WsRequestFullPayload = { requestId: string; token: string; locale: Locale } & WsRequestData

export type WsRequestData =
  | {
      event: 'update-group'
      data: WsUpdateGroupRequestData
    }
  | {
      event: 'delete-group'
      data: WsDeleteGroupRequestData
    }
  | {
      event: 'upsert-group-members'
      data: WsUpsertGroupMembersRequestData
    }
  | {
      event: 'create-group-membership-request'
      data: WsCreateGroupMembershipRequestRequestData
    }
  | {
      event: 'delete-group-membership-request'
      data: WsDeleteGroupMembershipRequestRequestData
    }
  | {
      event: 'group--membership-request--action'
      data: Ws_Group_MembershipRequest_Action_RequestData
    }
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

export const WsUpdateGroupRequestData = z.object({
  groupId: z.string(),
  data: z.object({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    photo: z.string().nullable().optional(),
    visibility: z.nativeEnum($Enums.GroupVisibility).optional(),
    emoji: z.string().optional(),
    baseCurrency: z.nativeEnum($Enums.Currency).optional(),
    note: z.string().nullable().optional()
  })
})

export type WsUpdateGroupRequestData = z.infer<typeof WsUpdateGroupRequestData>

export const WsDeleteGroupRequestData = z.string()

export type WsDeleteGroupRequestData = z.infer<typeof WsDeleteGroupRequestData>

export const AccountOrPlaceholderCreate = z.union([
  z.object({ accountId: z.string() }),
  z.object({
    accountAlias: z.union([
      z.object({
        type: z.literal('email-addr'),
        rawValue: z.string(),
        value: z.string()
      }),
      z.object({
        type: z.literal('phone-no'),
        rawValue: z.string(),
        value: z.object({
          number: z.string(), // contactValue
          type: z.enum(NUMBER_TYPES).optional(),
          countryCallingCode: z.string(),
          country: z.string().optional(),
          carrierCode: z.string().optional(),
          nationalNumber: z.string(),
          ext: z.string().optional(),
          formatInternational: z.string().optional(),
          __countryCallingCodeSource: z.string().optional()
        })
      })
    ])
  }),
  z.object({ accountPlaceholder: z.object({ name: z.string() }) })
])

export const WsUpsertGroupMembersRequestData = z.object({
  groupId: z.string(),
  type: z.enum(['replace-member']).optional(),
  data: z.object({
    members: z.object({
      creates: z
        .array(
          z.intersection(
            z.object({ order: z.number(), role: z.nativeEnum($Enums.GroupMemberRole).optional() }),
            AccountOrPlaceholderCreate
          )
        )
        .optional(),
      updates: z
        .array(
          z.intersection(
            z.object({
              id: z.string(),
              role: z.nativeEnum($Enums.GroupMemberRole).nullish(),
              nickname: z.string().nullish(),
              order: z.number().optional()
            }),
            z.union([AccountOrPlaceholderCreate, z.object({})])
          )
        )
        .optional(),
      deletes: z.array(z.object({ id: z.string() })).optional()
    })
  }),
  isMeLeavingGroup: z.boolean().optional(),
  isUpdateOrder: z.boolean().optional()
})

export type WsUpsertGroupMembersRequestData = z.infer<typeof WsUpsertGroupMembersRequestData>

export const WsCreateGroupMembershipRequestRequestData = z.object({
  groupId: z.string()
})

export type WsCreateGroupMembershipRequestRequestData = z.infer<typeof WsCreateGroupMembershipRequestRequestData>

export const WsDeleteGroupMembershipRequestRequestData = z.object({
  groupId: z.string()
})

export type WsDeleteGroupMembershipRequestRequestData = z.infer<typeof WsDeleteGroupMembershipRequestRequestData>

export const Ws_Group_MembershipRequest_Action_RequestData = z.object({
  groupId: z.string(),
  accountId: z.string(),
  requestId: z.string(),
  action: z.enum(['approve', 'reject'])
})

export type Ws_Group_MembershipRequest_Action_RequestData = z.infer<
  typeof Ws_Group_MembershipRequest_Action_RequestData
>

export type WsSendMessageRequestData = {
  groupId: string
  tabId: string
  uiId: string
  text: string
  sentAt: Date
}

export const WsCreateMoneyRecordRequestData = z.object({
  groupId: z.string(),
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
  groupId: z.string(),
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
  groupId: z.string(),
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
  groupId: z.string(),
  tabId: z.string(),
  id: z.string()
})

export type WsDeleteMessageRequestData = z.infer<typeof WsDeleteMessageRequestData>

export const WsSettleUpPayableRequestData = z.object({
  groupId: z.string(),
  tabId: z.string(),
  settlementId: z.string(),
  description: z.string().optional()
})

export type WsSettleUpPayableRequestData = z.infer<typeof WsSettleUpPayableRequestData>
