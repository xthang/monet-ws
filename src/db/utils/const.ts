import { Prisma } from '@prisma/client'

export const ACCOUNT_SELECT = {
  where: { deletedAt: null, isActive: true },
  select: {
    id: true,
    authAccountId: true,
    username: true,
    nickname: true,
    firstName: true,
    middleName: true,
    lastName: true,
    nameOrder: true,
    fullName: true,
    imageUrl: true,
    role: true,

    subscriptionPlan: true,
    subscriptionEndedAt: true,

    locale: true
  }
} as const satisfies { where: Prisma.AccountWhereInput; select: Prisma.AccountSelect }

const MEMBER_INCLUDE = {
  account: ACCOUNT_SELECT,
  accountAlias: {
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      accountId: true,
      account: ACCOUNT_SELECT, // TODO: only select the connected account if the alias is 'verified'. We are fixing this in code
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
    }
  },
  accountPlaceholder: { where: { deletedAt: null }, select: { id: true, name: true } }
} as const satisfies Prisma.ConversationMembershipInclude

export const MEMBER_SELECT = {
  id: true,
  accountId: true,
  accountAliasId: true,
  accountPlaceholderId: true,
  accountOrPlaceholderId: true,
  nickname: true,
  role: true,
  order: true,

  ...MEMBER_INCLUDE
} as const satisfies Prisma.ConversationMembershipSelect

export const MEMBER_SELECT_NO_WHERE = {
  id: true,
  accountId: true,
  accountAliasId: true,
  accountPlaceholderId: true,
  accountOrPlaceholderId: true,
  nickname: true,
  role: true,
  order: true,

  account: { select: MEMBER_SELECT.account.select },
  accountAlias: { select: MEMBER_SELECT.accountAlias.select },
  accountPlaceholder: { select: MEMBER_SELECT.accountPlaceholder.select }
} as const satisfies Prisma.ConversationMembershipSelect

export const MEMBER_SELECT_FOR_NOTIFY = {
  accountId: true,
  accountAliasId: true,
  account: {
    where: { deletedAt: null, isActive: true },
    select: {
      ...ACCOUNT_SELECT.select,
      locale: true,
      accountAliases: { where: { verificationStatus: 'verified', deletedAt: null, isActive: true } }
    }
  },
  accountAlias: { where: { deletedAt: null, isActive: true } } // verificationStatus: 'verified'
} as const satisfies Prisma.ConversationMembershipSelect

export const MEMBER_SELECT_FULL_FOR_NOTIFY = {
  ...MEMBER_SELECT_FOR_NOTIFY,
  accountPlaceholder: { where: { deletedAt: null } }
} as const satisfies Prisma.ConversationMembershipSelect
