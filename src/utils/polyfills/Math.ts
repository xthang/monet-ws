Math.maxBig = function <T extends bigint = bigint>(...values: T[]): T {
  return values.reduce((max, current) => (current > max ? current : max), values[0])
}
