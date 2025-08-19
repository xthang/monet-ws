import { GroupMembership, GroupTab, Prisma } from '@prisma/client'

import { PrismaClient, PrismaTransactionClient } from '@/db/types'
import { MoneyRecord, MoneyRecordPartaker } from '@/types/db'

function calculateMyMoneyRecord(
  accountID: string,
  moneyRecord: Omit<MoneyRecord, 'amount' | 'rate' | 'partakers'> & {
    tab: Pick<GroupTab, 'baseCurrency'>
    payerMember: Pick<GroupMembership, 'accountId'>
    partakers: (Pick<MoneyRecordPartaker, 'proportion'> & { member: { accountId: string | null } })[]
    amount: number | null
    rate: number | null
  },
  accountPayables: Record<string, { paid: number; received: number }>
) {
  const { tab, payerMember, partakers, amount, currency, ratePerBase, rate } = moneyRecord

  const invalidRequiredRate = currency !== tab.baseCurrency && (!rate || rate <= 0)
  const invalidDisallowdRate = currency === tab.baseCurrency && rate
  const noPartakers = partakers.every((p) => !p.proportion)

  let amountBaseCurr
  let amountPerPartaker
  let amountPerPartakerBaseCurr
  if (invalidRequiredRate || invalidDisallowdRate) {
    amountBaseCurr = null
    amountPerPartaker = null
    amountPerPartakerBaseCurr = null
  } else {
    amountBaseCurr = amount != null && rate != null ? (ratePerBase === false ? amount / rate : amount * rate) : null

    const totalShare = partakers.reduce(
      (previousValue, currentValue) => previousValue + (currentValue.proportion ?? 0),
      0
    )
    amountPerPartaker = amount != null && totalShare ? amount / totalShare : null
    amountPerPartakerBaseCurr =
      amountPerPartaker != null && rate != null
        ? ratePerBase === false
          ? amountPerPartaker / rate
          : amountPerPartaker * rate
        : null
  }

  if (amount == null || amountPerPartaker == null) return

  if (!accountPayables[tab.baseCurrency]) accountPayables[tab.baseCurrency] = { paid: 0, received: 0 }

  if (payerMember.accountId === accountID) accountPayables[tab.baseCurrency].paid += amountBaseCurr ?? amount

  for (const partaker of partakers) {
    if (partaker.member.accountId === accountID) {
      const proportion = partaker.proportion
      if (!proportion) continue
      accountPayables[tab.baseCurrency].received += proportion * (amountPerPartakerBaseCurr ?? amountPerPartaker)!
    }
  }
}

export default async function calculateMyPayables(
  accountId: string,
  orgId: string | undefined,
  db: PrismaClient | PrismaTransactionClient
) {
  const memberships = await db.groupMembership.findMany({
    where: {
      OR: [
        { accountId, accountOrPlaceholderId: accountId },
        { accountAlias: { accountId, verificationStatus: 'verified', deletedAt: null, isActive: true } }
      ],
      group: { orgId: orgId ?? null, deletedAt: null },
      isActive: true
    },
    select: { id: true }
  })
  const memberIds = memberships.map(({ id }) => id)

  if (!memberIds.length) return

  const records_ = await db.$queryRaw<MoneyRecord[]>`SELECT m.*
FROM "MoneyRecord" m
JOIN "GroupTab" t ON m."tabId" = t."id" AND t."deletedAt" IS NULL
JOIN "Group" c ON m."groupId" = c."id" AND c."deletedAt" IS NULL AND ${orgId ? Prisma.sql`c."orgId" = ${orgId}` : Prisma.sql`c."orgId" IS NULL`}
LEFT JOIN "MoneyRecordPartaker" m_partaker ON m_partaker."moneyRecordId" = m.id AND m_partaker."memberId" IN (${Prisma.join(memberIds)})
WHERE
  m."deletedAt" IS NULL
  AND (m."payerMemberId" IN (${Prisma.join(memberIds)}) OR m_partaker."memberId" IN (${Prisma.join(memberIds)}))`

  if (!records_.length) return

  const records = await db.moneyRecord.findMany({
    where: { id: { in: records_.map(({ id }) => id) } },
    include: {
      tab: { select: { baseCurrency: true } },
      payerMember: { select: { accountId: true } },
      partakers: {
        where: { deletedAt: null, isActive: true },
        select: { member: { select: { accountId: true } }, proportion: true }
      }
    },
    orderBy: [{ updatedAt: 'desc' }]
  })

  const data = records.map(({ amount, rate, partakers, ...it }) => ({
    ...it,
    amount: amount?.toNumber() ?? null,
    rate: rate?.toNumber() ?? null,
    // amountPerPartaker: amountPerPartaker?.toNumber() ?? null,
    partakers: partakers.map(({ proportion, ...p }) => ({
      ...p,
      proportion: proportion?.toNumber() ?? null
    }))
  }))

  const accountPayables = {}
  for (const record of data) {
    calculateMyMoneyRecord(accountId, record, accountPayables)
  }

  await db.account.update({ where: { id: accountId }, data: { payables: accountPayables } })
}
