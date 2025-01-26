import { $Enums } from '@prisma/client'
import { z } from 'zod'

import type { SupportedLocale } from '@/constants/locales'
import { NUMBER_TYPES } from '@/constants/phone-number'

import { AccountBasicInfo } from '../db'

export type Auth = {
  accountId: string
  // authAccountId: string
  orgId?: string

  locale: SupportedLocale | null

  otherAccountInfo: Pick<
    AccountBasicInfo,
    | 'authAccountId'
    | 'imageUrl'
    | 'username'
    | 'firstName'
    | 'middleName'
    | 'lastName'
    | 'nameOrder'
    | 'fullName'
    | 'nickname'
    | 'role'
  >
}

export type WsRequestFullPayload = { requestId: string; token: string; locale: SupportedLocale } & WsRequestData

export type WsRequestData =
  | {
      event: 'group--update'
      data: Ws_Group_Update_RequestData
    }
  | {
      event: 'group--delete'
      data: Ws_Group_Delete_RequestData
    }
  | {
      event: 'group-members--upsert'
      data: Ws_GroupMembers_Upsert_RequestData
    }
  | {
      event: 'group-membership-request--create'
      data: Ws_GroupMembershipRequest_Create_RequestData
    }
  | {
      event: 'group-membership-request--delete'
      data: Ws_GroupMembershipRequest_Delete_RequestData
    }
  | {
      event: 'group-membership-request--action'
      data: Ws_GroupMembershipRequest_Action_RequestData
    }
  | {
      event: 'group-tab--create'
      data: Ws_GroupTab_Create_RequestData
    }
  | {
      event: 'group-tab--update'
      data: Ws_GroupTab_Update_RequestData
    }
  | {
      event: 'group-tab--delete'
      data: Ws_GroupTab_Delete_RequestData
    }
  | {
      event: 'message--text--new'
      data: Ws_Message_Text_Send_RequestData
    }
  | {
      event: 'message--update'
      data: unknown
    }
  | {
      event: 'message--delete'
      data: Ws_Message_Delete_RequestData
    }
  | {
      event: 'money-record--new'
      data: Ws_MoneyRecord_Create_RequestData
    }
  | {
      event: 'money-record--update'
      data: Ws_MoneyRecord_Update_RequestData
    }
  | {
      event: 'money-record-partakers--upsert'
      data: Ws_MoneyRecordPartakers_Upsert_RequestData
    }
  | {
      event: 'money-record--expense-documents--upsert'
      data: Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData
    }
  | {
      event: 'payable--settle-up'
      data: Ws_Payable_SettleUp_RequestData
    }

export const Ws_Group_Update_RequestData = z.object({
  groupId: z.string(),
  data: z.object({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    photo: z.string().nullable().optional(),
    visibility: z.nativeEnum($Enums.GroupVisibility).optional(),
    emoji: z.string().optional(),
    defaultCurrency: z.nativeEnum($Enums.Currency).optional(),
    note: z.string().nullable().optional()
  })
})

export type Ws_Group_Update_RequestData = z.infer<typeof Ws_Group_Update_RequestData>

export const Ws_Group_Delete_RequestData = z.string()

export type Ws_Group_Delete_RequestData = z.infer<typeof Ws_Group_Delete_RequestData>

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

export const Ws_GroupMembers_Upsert_RequestData = z.object({
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

export type Ws_GroupMembers_Upsert_RequestData = z.infer<typeof Ws_GroupMembers_Upsert_RequestData>

export const Ws_GroupMembershipRequest_Create_RequestData = z.object({
  groupId: z.string()
})

export type Ws_GroupMembershipRequest_Create_RequestData = z.infer<typeof Ws_GroupMembershipRequest_Create_RequestData>

export const Ws_GroupMembershipRequest_Delete_RequestData = z.object({
  groupId: z.string()
})

export type Ws_GroupMembershipRequest_Delete_RequestData = z.infer<typeof Ws_GroupMembershipRequest_Delete_RequestData>

export const Ws_GroupMembershipRequest_Action_RequestData = z.object({
  groupId: z.string(),
  accountId: z.string(),
  requestId: z.string(),
  action: z.enum(['approve', 'reject', 'replace']),
  replacedMemberId: z.string().optional()
})

export type Ws_GroupMembershipRequest_Action_RequestData = z.infer<typeof Ws_GroupMembershipRequest_Action_RequestData>

export const Ws_GroupTab_Create_RequestData = z.object({
  groupId: z.string(),
  data: z.object({
    title: z.string(),
    color: z.string().optional(),
    baseCurrency: z.nativeEnum($Enums.Currency),
    order: z.number()
  })
})

export type Ws_GroupTab_Create_RequestData = z.infer<typeof Ws_GroupTab_Create_RequestData>

export const Ws_GroupTab_Update_RequestData = z.object({
  groupId: z.string(),
  data: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      color: z.string().optional(),
      baseCurrency: z.nativeEnum($Enums.Currency).optional(),
      order: z.number().optional()
    })
  )
})

export type Ws_GroupTab_Update_RequestData = z.infer<typeof Ws_GroupTab_Update_RequestData>

export const Ws_GroupTab_Delete_RequestData = z.object({
  groupId: z.string(),
  id: z.string()
})

export type Ws_GroupTab_Delete_RequestData = z.infer<typeof Ws_GroupTab_Delete_RequestData>

export type Ws_Message_Text_Send_RequestData = {
  groupId: string
  tabId: string
  uiId: string
  text: string
  sentAt: Date
}

export const Ws_Message_Delete_RequestData = z.object({
  groupId: z.string(),
  tabId: z.string(),
  id: z.string()
})

export type Ws_Message_Delete_RequestData = z.infer<typeof Ws_Message_Delete_RequestData>

export const Ws_MoneyRecord_Create_RequestData = z.object({
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

export type Ws_MoneyRecord_Create_RequestData = z.infer<typeof Ws_MoneyRecord_Create_RequestData>

export const Ws_MoneyRecord_Update_RequestData = z.object({
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

export type Ws_MoneyRecord_Update_RequestData = z.infer<typeof Ws_MoneyRecord_Update_RequestData>

export const Ws_MoneyRecordPartakers_Upsert_RequestData = z.object({
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

export type Ws_MoneyRecordPartakers_Upsert_RequestData = z.infer<typeof Ws_MoneyRecordPartakers_Upsert_RequestData>

export const Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData = z.object({
  groupId: z.string(),
  tabId: z.string(),
  messageId: z.string(),
  moneyRecordId: z.string(),
  data: z.object({
    create: z
      .array(
        z.object({
          uiId: z.string(),
          uploadRequestId: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
          size: z.number(),
          storageNamePrefix: z.string(),
          order: z.number()
        })
      )
      .optional(),
    update: z
      .array(
        z.object({
          id: z.string(),
          order: z.number()
        })
      )
      .optional(),
    delete: z.array(z.string()).optional()
  })
})

export type Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData = z.infer<
  typeof Ws_MoneyRecord_ExpenseDocuments_Upsert_RequestData
>

export const Ws_Payable_SettleUp_RequestData = z.object({
  groupId: z.string(),
  tabId: z.string(),
  settlementId: z.string(),
  description: z.string().optional()
})

export type Ws_Payable_SettleUp_RequestData = z.infer<typeof Ws_Payable_SettleUp_RequestData>
