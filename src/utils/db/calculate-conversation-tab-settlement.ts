import type { Conversation } from '@prisma/client'

import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

import calculateMoneyRecord from '../calculations/calculate-money-record'
import calculateBalances from '../calculations/calculate-payables'
import calculateSettlement from '../calculations/calculate-settlement'

export default async function calculateTabSettlement(
  accountId: string,
  db: PrismaClient | PrismaTransactionClient,
  conversationId: string,
  conversation: Pick<Conversation, 'baseCurrency'>,
  tabId: string
) {
  const members = await db.conversationMembership.findMany({ where: { conversationId, isActive: true } })
  const memberDict = Object.fromEntries(
    members.map(({ id }) => [
      id,
      {
        id,
        calculated: null as unknown as {
          paid: number
          payable: number
          received: number
          payments?: { payeeMemberId: string; amount: number }[]
        }
      }
    ])
  )

  const _moneyRecords = await db.moneyRecord.findMany({
    where: { conversationId, tabId, deletedAt: null, amount: { not: null } },
    select: {
      payerMemberId: true,
      currency: true,
      amount: true,
      ratePerBase: true,
      rate: true,
      partakers: {
        where: { deletedAt: null, isActive: true },
        select: { moneyRecordId: true, memberId: true, proportion: true }
      }
    }
  })

  // Adding deleted members to memberDict
  for (const { payerMemberId, partakers } of _moneyRecords) {
    if (!memberDict[payerMemberId]) memberDict[payerMemberId] = { id: payerMemberId, calculated: null as any }

    for (const { memberId, proportion } of partakers) {
      if (proportion != null && !memberDict[memberId]) memberDict[memberId] = { id: memberId, calculated: null as any }
    }
  }

  const moneyRecords = _moneyRecords.map(({ amount, rate, partakers, ...moneyRecord }) => ({
    moneyRecord: {
      ...moneyRecord,
      amount: amount!.toNumber(),
      rate: rate?.toNumber() ?? null,
      partakers: Object.fromEntries(
        partakers.map(({ memberId, proportion, ...p }) => [
          memberId,
          { ...p, proportion: proportion?.toNumber() ?? null }
        ])
      ),
      calculated: {}
    }
  }))

  for (const {
    moneyRecord: { currency, amount, ratePerBase, rate, partakers, calculated }
  } of moneyRecords) {
    const invalidRequiredRate = currency !== conversation.baseCurrency && (!rate || rate <= 0)
    const invalidDisallowdRate = currency === conversation.baseCurrency && rate

    calculateMoneyRecord(amount, ratePerBase, rate, invalidRequiredRate, invalidDisallowdRate, partakers, calculated)
  }

  calculateBalances(memberDict, moneyRecords)

  const [_bestAlgos, _selectedBestAlgo] = calculateSettlement(memberDict)

  await db.conversationTabSuggestedSettlement.deleteMany({ where: { conversationId, tabId } })

  await db.conversationTabSuggestedSettlement.createMany({
    data: Object.values(memberDict).flatMap(
      (m) =>
        m.calculated.payments?.map(({ payeeMemberId, amount }) => ({
          conversationId,
          tabId,
          payorMemberId: m.id,
          payeeMemberId,
          amount,
          createdBy: accountId
        })) ?? []
    )
  })
}
