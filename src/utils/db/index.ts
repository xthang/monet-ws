import assert from 'assert'

import { $Enums, type Prisma } from '@prisma/client'

import db from '@/db'
import { WsError } from '@/types/error'

import { ACCOUNT_SELECT } from './query-constants'

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

export async function findUniqueGroupMembershipOrThrow<
  MembershipSelect extends Prisma.GroupMembershipSelect | null = null,
  MembershipInclude extends Prisma.GroupMembershipInclude | null = null
>(
  prisma: typeof db,
  groupId: string,
  accountId: string,
  orgId: string | undefined,
  select?: { select?: MembershipSelect; include?: MembershipInclude }
) {
  const memberships = await prisma.groupMembership.findMany<{
    where: Prisma.GroupMembershipWhereUniqueInput
    select: MembershipSelect
    include: MembershipInclude
  }>({
    where: {
      OR: [
        { accountId, accountOrPlaceholderId: accountId },
        { accountAlias: { accountId, deletedAt: null, isActive: true, verificationStatus: 'verified' } }
      ],
      groupId,
      isActive: true,
      group: { orgId: orgId ?? null, deletedAt: null }
    },
    ...select
  })
  // Note: there are cases where many memberships exist in the same group for 1 account.
  // For example: a user adds a not-'verified' alias of their account into the same group. And later on, that alias is 'verified'
  // Example 2: many aliases are added to the same group and later on, these aliases belong to the same newly-registered account
  const groupIds = new Set(memberships.map((m) => m.groupId))
  assert(
    groupIds.size === 1,
    new WsError('INVALID_MEMBERSHIPS', `memberships found: ${memberships.length} | groups found: ${groupIds.size}`)
  )
  // return membership that is attached with an account first. If none found, return any membership (which is attached with an alias)
  return memberships.find((m) => m.accountId) ?? memberships[0]
}

export async function findUniqueMessageOrThrow<
  MembershipSelect extends Prisma.GroupMembershipSelect | null = null,
  MembershipInclude extends Prisma.GroupMembershipInclude | null = null,
  MessageSelect extends Prisma.MessageSelect | null = null,
  MessageInclude extends Prisma.MessageInclude | null = null
>(
  prisma: typeof db,
  groupId: string,
  tabId: string,
  messageId: string,
  accountId: string,
  orgId: string | undefined,
  select?: {
    membership?: { select?: MembershipSelect; include?: MembershipInclude }
    message?: { select?: MessageSelect; include?: MessageInclude }
  }
) {
  const membership = await findUniqueGroupMembershipOrThrow<MembershipSelect, MembershipInclude>(
    prisma,
    groupId,
    accountId,
    orgId,
    select?.membership
  )
  const message = await prisma.message.findUniqueOrThrow<{
    where: Prisma.MessageWhereUniqueInput
    select: MessageSelect
    // include: MessageInclude
  }>({
    where: { id: messageId, groupId, tabId },
    ...select?.message
  })
  return [membership, message] as const
}

export async function findUniqueMoneyRecordOrThrow<
  MembershipSelect extends Prisma.GroupMembershipSelect | null = null,
  MembershipInclude extends Prisma.GroupMembershipInclude | null = null,
  MessageSelect extends Prisma.MessageSelect | null = null,
  MessageInclude extends Prisma.MessageInclude | null = null,
  MoneyRecordSelect extends Prisma.MoneyRecordSelect | null = null,
  MoneyRecordInclude extends Prisma.MoneyRecordInclude | null = null
>(
  prisma: typeof db,
  groupId: string,
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
  >(prisma, groupId, tabId, messageId, accountId, orgId, select)
  const moneyRecord = await prisma.moneyRecord.findUniqueOrThrow<{
    where: Prisma.MoneyRecordWhereUniqueInput
    select: MoneyRecordSelect
    // include: MoneyRecordInclude
  }>({
    where: { id: moneyRecordId, messageId, groupId },
    ...select?.moneyRecord
  })
  return [membership, message, moneyRecord] as const
}
