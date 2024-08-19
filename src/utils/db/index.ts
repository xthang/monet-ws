import assert from 'assert'

import { $Enums, type Prisma } from '@prisma/client'

import db from '../../db/index.js'
import { ApiError } from '../../types/error.js'

import { ACCOUNT_SELECT } from './const.js'

export async function findUniqueAccountOrThrow<
  AccountSelect extends Prisma.AccountSelect,
  AccountInclude extends Prisma.AccountInclude
>(prisma: typeof db, accountId: string, select?: AccountSelect, include?: AccountInclude) {
  return prisma.account.findUniqueOrThrow<{
    where: Prisma.AccountWhereUniqueInput
    select: AccountSelect
    include: AccountInclude
  }>({
    where: { id: accountId, OR: [{ status: null }, { status: { not: $Enums.AccountStatus.banned } }] },
    select: { ...ACCOUNT_SELECT, ...select },
    include
  })
}

export async function findUniqueAccountByAuthAccIdOrThrow<
  AccountSelect extends Prisma.AccountSelect,
  AccountInclude extends Prisma.AccountInclude
>(prisma: typeof db, authAccountId: string, select?: AccountSelect, include?: AccountInclude) {
  return prisma.account.findUniqueOrThrow<{
    where: Prisma.AccountWhereUniqueInput
    select: AccountSelect
    include: AccountInclude
  }>({
    where: { authAccountId, OR: [{ status: null }, { status: { not: $Enums.AccountStatus.banned } }] },
    select: { ...ACCOUNT_SELECT, ...select },
    include
  })
}

export async function findUniqueConversationMembershipOrThrow<
  MembershipSelect extends Prisma.ConversationMembershipSelect | null = null,
  MembershipInclude extends Prisma.ConversationMembershipInclude | null = null
>(
  prisma: typeof db,
  conversationId: string,
  accountId: string,
  orgId: string | undefined,
  select?: { select?: MembershipSelect; include?: MembershipInclude }
) {
  const memberships = await prisma.conversationMembership.findMany<{
    where: Prisma.ConversationMembershipWhereUniqueInput
    select: MembershipSelect
    include: MembershipInclude
  }>({
    where: {
      OR: [
        { accountId, accountOrPlaceholderId: accountId },
        { accountAlias: { accountId, deletedAt: null, isActive: true, verificationStatus: 'verified' } }
      ],
      conversationId,
      isActive: true,
      conversation: { orgId: orgId ?? null, deletedAt: null }
    },
    ...select
  })
  // Note: there are cases where many memberships exist in the same conversation for 1 account.
  // For example: a user adds a not-'verified' alias of their account into the same conversation. And later on, that alias is 'verified'
  // Example 2: many aliases are added to the same group and later on, these aliases belong to the same newly-registered account
  const conversationIds = new Set(memberships.map((m) => m.conversationId))
  assert(
    conversationIds.size === 1,
    new ApiError(
      'INVALID_MEMBERSHIPS',
      `memberships found: ${memberships.length} | conversations found: ${conversationIds.size}`
    )
  )
  // return membership that is attached with an account first. If none found, return any membership (which is attached with an alias)
  return memberships.find((m) => m.accountId) ?? memberships[0]
}

export async function findUniqueMessageOrThrow<
  MembershipSelect extends Prisma.ConversationMembershipSelect | null = null,
  MembershipInclude extends Prisma.ConversationMembershipInclude | null = null,
  MessageSelect extends Prisma.MessageSelect | null = null,
  MessageInclude extends Prisma.MessageInclude | null = null
>(
  prisma: typeof db,
  conversationId: string,
  tabId: string,
  messageId: string,
  accountId: string,
  orgId: string | undefined,
  select?: {
    membership?: { select?: MembershipSelect; include?: MembershipInclude }
    message?: { select?: MessageSelect; include?: MessageInclude }
  }
) {
  const membership = await findUniqueConversationMembershipOrThrow<MembershipSelect, MembershipInclude>(
    prisma,
    conversationId,
    accountId,
    orgId,
    select?.membership
  )
  const message = await prisma.message.findUniqueOrThrow<{
    where: Prisma.MessageWhereUniqueInput
    select: MessageSelect
    // include: MessageInclude
  }>({
    where: { id: messageId, conversationId, tabId },
    ...select?.message
  })
  return [membership, message] as const
}

export async function findUniqueMoneyRecordOrThrow<
  MembershipSelect extends Prisma.ConversationMembershipSelect | null = null,
  MembershipInclude extends Prisma.ConversationMembershipInclude | null = null,
  MessageSelect extends Prisma.MessageSelect | null = null,
  MessageInclude extends Prisma.MessageInclude | null = null,
  MoneyRecordSelect extends Prisma.MoneyRecordSelect | null = null,
  MoneyRecordInclude extends Prisma.MoneyRecordInclude | null = null
>(
  prisma: typeof db,
  conversationId: string,
  tabId: string,
  messageId: string,
  moneyRecordId: string,
  accountId: string,
  orgId: string | undefined,
  select?: {
    membership?: { select?: MembershipSelect; include?: MembershipInclude }
    message?: { select?: MessageSelect; include?: MessageInclude }
    moneyRecord?: { select?: MoneyRecordSelect; include?: MoneyRecordInclude }
  }
) {
  const [membership, message] = await findUniqueMessageOrThrow<
    MembershipSelect,
    MembershipInclude,
    MessageSelect,
    MessageInclude
  >(prisma, conversationId, tabId, messageId, accountId, orgId, select)
  const moneyRecord = await prisma.moneyRecord.findUniqueOrThrow<{
    where: Prisma.MoneyRecordWhereUniqueInput
    select: MoneyRecordSelect
    // include: MoneyRecordInclude
  }>({
    where: { id: moneyRecordId, messageId, conversationId },
    ...select?.moneyRecord
  })
  return [membership, message, moneyRecord] as const
}
