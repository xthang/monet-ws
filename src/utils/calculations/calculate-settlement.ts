import '../polyfills/Array'

type Calculated = {
  id: string
  _payable: number
  payments?: { payeeMemberId: string; amount: number }[]
}

export default function calculateSettlement(
  memberDict: Record<
    string,
    {
      id: string
      calculated: {
        paid: number
        received: number
        payable: number
        payments?: { payeeMemberId: string; amount: number }[]
      }
    }
  >
) {
  const members = Object.values(memberDict)

  let bests: {
    algorithm: 'max-max' | 'max-min' | 'min-min' | 'min-min-gt'
    calculated: { [id: string]: Calculated }
    transactions: number
  }[] = []

  for (const algorithm of ['max-max', 'max-min', 'min-min', 'min-min-gt'] as const) {
    const calculatedMap: { [id: string]: Calculated } = {}

    // store a temp _payable value inside calculated for later calculation
    for (const { id, calculated } of members) {
      calculatedMap[id] = { id, _payable: calculated.payable }
    }

    if (algorithm === 'max-max') {
      // while true: max payable P pays max receivable R
      // this will tend to allocate the transactions by payables equally

      while (true) {
        const maxPayable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable > 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable > calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )
        const maxReceivable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable < 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable < calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )

        // stop if all _payable amounts are 0
        if (!maxPayable || !maxReceivable) break

        const amount = Math.min(maxPayable._payable, -maxReceivable._payable!)

        if (!maxPayable.payments) maxPayable.payments = []
        maxPayable.payments!.push({ payeeMemberId: maxReceivable.id, amount })

        maxPayable._payable! -= amount
        maxReceivable._payable! += amount
      }
    } else if (algorithm === 'max-min') {
      // while true: max payable P pays min receivable R

      while (true) {
        const maxPayable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable > 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable > calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )
        const minReceivable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable < 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable > calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )

        // stop if all _payable amounts are 0
        if (!maxPayable || !minReceivable) break

        const amount = Math.min(maxPayable._payable, -minReceivable._payable!)

        if (!maxPayable.payments) maxPayable.payments = []
        maxPayable.payments!.push({ payeeMemberId: minReceivable.id, amount })

        maxPayable._payable! -= amount
        minReceivable._payable! += amount
      }
    } else if (algorithm === 'min-min-gt') {
      // while true: min payable P pays min receivable R which is greater than P
      // this will try to offset the payables as many as possible, and tends to allocate payments to the highest payables' group

      while (true) {
        const minPayable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable > 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable < calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )
        const minReceivable =
          minPayable &&
          Object.values(calculatedMap).reduce<Calculated | undefined>(
            (previousValue, currentValue) =>
              calculatedMap[currentValue.id]._payable < 0 &&
              (!previousValue ||
                (minPayable._payable <= -calculatedMap[currentValue.id]._payable &&
                  -calculatedMap[currentValue.id]._payable < -calculatedMap[previousValue.id]._payable) ||
                (minPayable._payable >= -calculatedMap[previousValue.id]._payable &&
                  -calculatedMap[currentValue.id]._payable > minPayable._payable))
                ? currentValue
                : previousValue,
            undefined
          )

        // stop if all _payable amounts are 0
        if (!minPayable || !minReceivable) break

        const amount = Math.min(minPayable._payable, -minReceivable._payable!)

        if (!minPayable.payments) minPayable.payments = []
        minPayable.payments!.push({ payeeMemberId: minReceivable.id, amount })

        minPayable._payable! -= amount
        minReceivable._payable! += amount
      }
    } else {
      // DEFAULT: min-min
      // while true: min payable P pays min receivable R
      // this tends to allocate the transactions by payables equally

      while (true) {
        const minPayable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable > 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable < calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )
        const minReceivable = Object.values(calculatedMap).reduce<Calculated | undefined>(
          (previousValue, currentValue) =>
            calculatedMap[currentValue.id]._payable < 0 &&
            (!previousValue || calculatedMap[currentValue.id]._payable > calculatedMap[previousValue.id]._payable)
              ? currentValue
              : previousValue,
          undefined
        )

        // stop if all _payable amounts are 0
        if (!minPayable || !minReceivable) break

        const amount = Math.min(minPayable._payable, -minReceivable._payable!)

        if (!minPayable.payments) minPayable.payments = []
        minPayable.payments!.push({ payeeMemberId: minReceivable.id, amount })

        minPayable._payable! -= amount
        minReceivable._payable! += amount
      }
    }

    Object.values(calculatedMap).forEach((c) => {
      c.payments = c.payments?.filter((p) => p.amount >= 1e-9)
    })

    const transactions = Object.values(calculatedMap).reduce(
      (previousValue, currentValue) => previousValue + (currentValue.payments?.length ?? 0),
      0
    )

    if (!transactions) continue

    if (!bests.length || transactions > bests[0].transactions) {
      bests = [{ algorithm, calculated: calculatedMap, transactions }]
    } else if (transactions == bests[0].transactions) {
      bests.push({ algorithm, calculated: calculatedMap, transactions })
    }
  }

  // prefer min-min algorithm result if it is in best list
  const best = bests.find((it) => it.algorithm === 'max-min') ?? bests.random()

  for (const { id, calculated } of members) {
    calculated.payments = best?.calculated[id].payments
  }

  return [bests.map((it) => it.algorithm), best?.algorithm] as [string[], string | undefined]
}
