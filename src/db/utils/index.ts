import assert from 'assert'

import { $Enums, type Prisma } from '@prisma/client'

import { ApiError } from '../../types/error.js'
import db from '../index.js'

import { ACCOUNT_SELECT } from './const.js'

export async function findUniqueAccountOrThrow<S extends Prisma.AccountSelect, T extends Prisma.AccountInclude>(prisma: typeof db, accountId: string, select?: S, include?: T) {
  return prisma.account.findUniqueOrThrow<{ where: Prisma.AccountWhereUniqueInput; select: S; include: T }>({
    where: { id: accountId, OR: [{ status: null }, { status: { not: $Enums.AccountStatus.banned } }] },
    select: { ...ACCOUNT_SELECT.select, ...select },
    include
  })
}

export async function findUniqueAccountByAuthAccIdOrThrow<S extends Prisma.AccountSelect, T extends Prisma.AccountInclude>(
  prisma: typeof db,
  authAccountId: string,
  select?: S,
  include?: T
) {
  return prisma.account.findUniqueOrThrow<{ where: Prisma.AccountWhereUniqueInput; select: S; include: T }>({
    where: { authAccountId, OR: [{ status: null }, { status: { not: $Enums.AccountStatus.banned } }] },
    select: { ...ACCOUNT_SELECT.select, ...select },
    include
  })
}

export async function findUniqueConversationMembershipOrThrow<T extends Prisma.ConversationMembershipInclude>(
  prisma: typeof db,
  conversationId: string,
  accountId: string,
  orgId: string | undefined,
  // isInTestMode: boolean,
  include?: T
) {
  const memberships = await prisma.conversationMembership.findMany<{
    where: Prisma.ConversationMembershipWhereUniqueInput
    include: T
  }>({
    where: {
      OR: [{ accountId, accountOrPlaceholderId: accountId }, { accountAlias: { accountId, deletedAt: null, isActive: true, verificationStatus: 'verified' } }],
      conversationId,
      isActive: true,
      conversation: { orgId: orgId ?? null, deletedAt: null }
    },
    include
  })
  // Note: there are cases where many memberships exist in the same conversation for 1 account.
  // For example: a user adds a not-'verified' alias of their account into the same conversation. And later on, that alias is 'verified'
  // Example 2: many aliases are added to the same group and later on, these aliases belong to the same newly-registered account
  const conversationIds = new Set(memberships.map((m) => m.conversationId))
  assert(conversationIds.size === 1, new ApiError('INVALID_MEMBERSHIPS', `memberships found: ${memberships.length} | conversations found: ${conversationIds.size}`))
  // return membership that is attached with an account first. If none found, return any membership (which is attached with an alias)
  return memberships.find((m) => m.accountId) ?? memberships[0]
}
