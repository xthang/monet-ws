import type { Prisma } from '@prisma/client'

export const ACCOUNT_SELECT = {
  id: true,
  authAccountId: true,
  username: true,
  firstName: true,
  middleName: true,
  lastName: true,
  nameOrder: true,
  fullName: true,
  nickname: true,
  imageUrl: true,
  role: true
} as const satisfies Prisma.AccountSelect

export const ACCOUNT_SELECT__SUBSCRIPTION = {
  ...ACCOUNT_SELECT,
  subscriptionOrder: {
    where: { deletedAt: null, deletedBy: null },
    select: { items: { where: { deleted_at: null, deleted_by: null }, select: { product: { select: { id: true } } } } }
  },
  subscriptionEndedAt: true
} as const satisfies Prisma.AccountSelect

export const ACCOUNT_SELECT_WHERE = {
  where: { deletedAt: null, isActive: true },
  select: ACCOUNT_SELECT
} as const satisfies { where: Prisma.AccountWhereInput; select: Prisma.AccountSelect }

export const ACCOUNT_SELECT_WHERE__SUBSCRIPTION = {
  where: { deletedAt: null, isActive: true },
  select: ACCOUNT_SELECT__SUBSCRIPTION
} as const satisfies { where: Prisma.AccountWhereInput; select: Prisma.AccountSelect }

export const ACCOUNT_ALIAS_SELECT = {
  id: true,
  accountId: true,
  type: true,
  rawValue: true,
  contactValue: true,
  valueType: true,
  contactGroup: true,
  contactGroupName: true,
  contactGroup1: true,
  contactBody: true,
  contactExt: true,
  formatted: true,
  verificationStatus: true
} as const satisfies Prisma.AccountAliasSelect

const ACCOUNT_PLACEHOLDER_SELECT = {
  id: true,
  name: true
} as const satisfies Prisma.AccountPlaceholderSelect

export const MEMBER_SELECT = {
  id: true,
  accountId: true,
  accountAliasId: true,
  accountPlaceholderId: true,
  accountOrPlaceholderId: true,
  nickname: true,
  role: true,
  order: true
} as const satisfies Prisma.GroupMembershipSelect

export const MEMBER_SELECT_WHERE = {
  ...MEMBER_SELECT,

  account: ACCOUNT_SELECT_WHERE__SUBSCRIPTION,
  accountAlias: {
    where: { verificationStatus: 'verified', deletedAt: null, isActive: true },
    select: {
      ...ACCOUNT_ALIAS_SELECT,
      account: ACCOUNT_SELECT_WHERE__SUBSCRIPTION // TODO: only select the connected account if the alias is 'verified' and the account is in the current org. We are fixing this in code
    }
  },
  accountPlaceholder: { where: { deletedAt: null }, select: ACCOUNT_PLACEHOLDER_SELECT }
} as const satisfies Prisma.GroupMembershipSelect

export const MEMBER_SELECT_NO_WHERE = {
  id: true,
  accountId: true,
  accountAliasId: true,
  accountPlaceholderId: true,
  accountOrPlaceholderId: true,
  nickname: true,
  role: true,
  order: true,

  account: { select: ACCOUNT_SELECT },
  accountAlias: {
    select: {
      ...ACCOUNT_ALIAS_SELECT,
      account: ACCOUNT_SELECT_WHERE // TODO: only select the connected account if the alias is 'verified' and the account is in the current org. We are fixing this in code
    }
  },
  accountPlaceholder: { select: ACCOUNT_PLACEHOLDER_SELECT }
} as const satisfies Prisma.GroupMembershipSelect

export const MEMBER_SELECT_FOR_NOTIFY = {
  account: {
    include: {
      accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
    }
  },
  accountAlias: {
    where: { deletedAt: null, isActive: true }, // verificationStatus: 'verified'
    select: ACCOUNT_ALIAS_SELECT
  },
  nickname: true,

  deletedAt: true,
  deletedBy: true,
  isActive: true
} as const satisfies Prisma.GroupMembershipSelect

export const MEMBER_SELECT_FULL_FOR_NOTIFY = {
  ...MEMBER_SELECT_FOR_NOTIFY,
  accountPlaceholder: true
} as const satisfies Prisma.GroupMembershipSelect

export const MESSAGE_SELECT = {
  id: true,
  uiId: true,
  groupId: true,
  tabId: true,
  text: true,
  moneyRecordId: true,
  // moneyRecord: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
  deletedByAccount: { select: ACCOUNT_SELECT },
  sentAt: true,
  sentBy: true
} as const satisfies Prisma.MessageSelect

export const MONEY_RECORD_PARTAKER_SELECT = {
  id: true,
  memberId: true,
  member: { select: { ...MEMBER_SELECT_NO_WHERE, deletedAt: true, deletedBy: true } },
  proportion: true
} as const satisfies Prisma.MoneyRecordPartakerSelect

export const MONEY_RECORD_SELECT = {
  id: true,
  groupId: true,
  tabId: true,
  messageId: true,
  time: true,
  type: true,
  description: true,
  note: true,
  payerMemberId: true,
  payerMember: { select: { ...MEMBER_SELECT_NO_WHERE, deletedAt: true, deletedBy: true } },
  amount: true,
  currency: true,
  ratePerBase: true,
  rate: true,
  partakers: {
    where: { deletedAt: null, isActive: true },
    select: MONEY_RECORD_PARTAKER_SELECT
  },
  amountPerPartaker: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
  deletedByAccount: { select: ACCOUNT_SELECT },
  settlementId: true,
  settledById: true,
  status: true
} as const satisfies Prisma.MoneyRecordSelect
