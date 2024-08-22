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

const ACCOUNT_SELECT_WHERE = {
  where: { deletedAt: null, isActive: true },
  select: ACCOUNT_SELECT
} as const satisfies { where: Prisma.AccountWhereInput; select: Prisma.AccountSelect }

const ACCOUNT_ALIAS_SELECT = {
  id: true,
  accountId: true,
  account: ACCOUNT_SELECT_WHERE, // TODO: only select the connected account if the alias is 'verified' and the account is in the current org. We are fixing this in code
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

export const MEMBER_SELECT_WHERE = {
  id: true,
  accountId: true,
  accountAliasId: true,
  accountPlaceholderId: true,
  accountOrPlaceholderId: true,
  nickname: true,
  role: true,
  order: true,

  account: ACCOUNT_SELECT_WHERE,
  accountAlias: {
    where: { deletedAt: null, isActive: true },
    select: ACCOUNT_ALIAS_SELECT
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
  accountAlias: { select: ACCOUNT_ALIAS_SELECT },
  accountPlaceholder: { select: ACCOUNT_PLACEHOLDER_SELECT }
} as const satisfies Prisma.GroupMembershipSelect

export const MEMBER_SELECT_FOR_NOTIFY = {
  account: {
    include: {
      accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
    }
  },
  accountAlias: true,
  nickname: true
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
  status: true
} as const satisfies Prisma.MoneyRecordSelect
