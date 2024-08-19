Number.prototype.format = function (locale, maximumFractionDigits) {
  const value = this.valueOf()
  if (value > 0 && value < 0.00001) {
    return '<0.00001'
  }
  if (value < 0 && value > -0.00001) {
    return '~-0.00001'
  }
  return value.toLocaleString(locale, {
    maximumFractionDigits:
      maximumFractionDigits ??
      (-0.001 < value && value < 0.001 ? 5 : -0.01 < value && value < 0.01 ? 4 : -1 < value && value < 1 ? 3 : 2)
  })
}
