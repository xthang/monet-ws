export default function calculateBalances(
  memberDict: Record<string, { calculated: { paid: number; payable: number; received: number } }>,
  messages: {
    moneyRecord?: {
      payerMemberId: string
      amount: number
      partakers: { [memberId: string]: { proportion: number | null } }
      calculated: Calculated
    } | null
  }[]
) {
  for (const m of Object.values(memberDict)) {
    m.calculated = { paid: 0, payable: 0, received: 0 }
  }

  for (const { moneyRecord } of messages) {
    if (!moneyRecord) continue

    const { payerMemberId, partakers, calculated } = moneyRecord
    const amount = moneyRecord.amount
    if (amount == null || calculated.amountPerPartaker == null) continue

    memberDict[payerMemberId].calculated.paid += calculated.amountBaseCurr ?? amount

    for (const [id, partaker] of Object.entries(partakers)) {
      const proportion = partaker.proportion
      if (!proportion) continue
      memberDict[id].calculated.received +=
        proportion * (calculated.amountPerPartakerBaseCurr ?? calculated.amountPerPartaker)!
    }
  }

  for (const m of Object.values(memberDict)) {
    m.calculated.payable = m.calculated.received - m.calculated.paid
  }
}
