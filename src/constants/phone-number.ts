import type { NumberType } from 'libphonenumber-js'

// const phoneNoRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im

export const NUMBER_TYPES = [
  'PREMIUM_RATE',
  'TOLL_FREE',
  'SHARED_COST',
  'VOIP',
  'PERSONAL_NUMBER',
  'PAGER',
  'UAN',
  'VOICEMAIL',
  'FIXED_LINE_OR_MOBILE',
  'FIXED_LINE',
  'MOBILE'
] as const satisfies NonNullable<NumberType>[]
