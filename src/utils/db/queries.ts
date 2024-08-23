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
  MembershipSelectOrInclude extends { select?: Prisma.GroupMembershipSelect; include?: Prisma.GroupMembershipInclude }
>(
  prisma: typeof db,
  groupId: string,
  accountId: string,
  orgId: string | undefined,
  selectOrInclude?: MembershipSelectOrInclude
) {
  const memberships = await prisma.groupMembership.findMany<
    { where: Prisma.GroupMembershipWhereUniqueInput } & MembershipSelectOrInclude
  >({
    where: {
      OR: [
        { accountId, accountOrPlaceholderId: accountId },
        { accountAlias: { accountId, deletedAt: null, isActive: true, verificationStatus: 'verified' } }
      ],
      groupId,
      isActive: true,
      group: { orgId: orgId ?? null, deletedAt: null }
    },
    ...selectOrInclude
  } satisfies Prisma.GroupMembershipFindManyArgs as any)
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
  MembershipSelectOrInclude extends { select?: Prisma.GroupMembershipSelect; include?: Prisma.GroupMembershipInclude },
  MessageSelectOrInclude extends { select?: Prisma.MessageSelect; include?: Prisma.MessageInclude }
>(
  prisma: typeof db,
  groupId: string,
  tabId: string,
  messageId: string,
  accountId: string,
  orgId: string | undefined,
  selectOrInclude?: {
    membership?: MembershipSelectOrInclude
    message?: MessageSelectOrInclude
  }
) {
  const membership = await findUniqueGroupMembershipOrThrow(
    prisma,
    groupId,
    accountId,
    orgId,
    selectOrInclude?.membership
  )
  const message = await prisma.message.findUniqueOrThrow<
    { where: Prisma.MessageWhereUniqueInput } & MessageSelectOrInclude
  >({
    where: { id: messageId, groupId, tabId },
    ...selectOrInclude?.message
  } satisfies Prisma.MessageFindManyArgs as any)
  return [membership, message] as const
}

export async function findUniqueMoneyRecordOrThrow<
  MembershipSelectOrInclude extends { select?: Prisma.GroupMembershipSelect; include?: Prisma.GroupMembershipInclude },
  MessageSelectOrInclude extends { select?: Prisma.MessageSelect; include?: Prisma.MessageInclude },
  MoneyRecordSelectOrInclude extends { select?: Prisma.MoneyRecordSelect; include?: Prisma.MoneyRecordInclude }
>(
  prisma: typeof db,
  groupId: string,
  tabId: string,
  messageId: string,
  moneyRecordId: string,
  accountId: string,
  orgId: string | undefined,
  selectOrInclude?: {
    membership?: MembershipSelectOrInclude
    message?: MessageSelectOrInclude
    moneyRecord?: MoneyRecordSelectOrInclude
  }
) {
  const [membership, message] = await findUniqueMessageOrThrow(
    prisma,
    groupId,
    tabId,
    messageId,
    accountId,
    orgId,
    selectOrInclude
  )
  const moneyRecord = await prisma.moneyRecord.findUniqueOrThrow<
    { where: Prisma.MoneyRecordWhereUniqueInput } & MoneyRecordSelectOrInclude
  >({
    where: { id: moneyRecordId, messageId, groupId },
    ...selectOrInclude?.moneyRecord
  } satisfies Prisma.MoneyRecordFindManyArgs as any)
  return [membership, message, moneyRecord] as const
}
