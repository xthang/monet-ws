import '../polyfills/Number'

export default function calculateMoneyRecord(
  amount: number | null,
  ratePerBase: boolean | null,
  rate: number | null,
  invalidRequiredRate: boolean,
  invalidDisallowdRate: number | false | null,
  partakers: { [memberId: string]: { proportion: number | null } },
  calculated: Calculated
) {
  let amountBaseCurr
  let amountPerPartaker
  let amountPerPartakerBaseCurr
  if (invalidRequiredRate || invalidDisallowdRate) {
    amountBaseCurr = null
    amountPerPartaker = null
    amountPerPartakerBaseCurr = null
  } else {
    amountBaseCurr = amount != null && rate != null ? (ratePerBase === false ? amount / rate : amount * rate) : null

    const totalShare = Object.values(partakers).reduce(
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

  let changed
  if (amountBaseCurr !== calculated.amountBaseCurr) {
    calculated.amountBaseCurr = amountBaseCurr
    // calculated.amountBaseCurr_ = calculated.amountBaseCurr?.format(locale)
    changed = true
  }
  if (amountPerPartaker !== calculated.amountPerPartaker) {
    calculated.amountPerPartaker = amountPerPartaker
    // calculated.amountPerPartaker_ = calculated.amountPerPartaker?.format(locale)
    changed = true
  }
  if (amountPerPartakerBaseCurr !== calculated.amountPerPartakerBaseCurr) {
    calculated.amountPerPartakerBaseCurr = amountPerPartakerBaseCurr
    // calculated.amountPerPartakerBaseCurr_ = calculated.amountPerPartakerBaseCurr?.format(locale)
    changed = true
  }

  return changed
}
