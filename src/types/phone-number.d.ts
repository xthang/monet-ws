export type NumberType =
  | undefined
  | 'PREMIUM_RATE'
  | 'TOLL_FREE'
  | 'SHARED_COST'
  | 'VOIP'
  | 'PERSONAL_NUMBER'
  | 'PAGER'
  | 'UAN'
  | 'VOICEMAIL'
  | 'FIXED_LINE_OR_MOBILE'
  | 'FIXED_LINE'
  | 'MOBILE'

type PhoneNumber = {
  number: string
  countryCallingCode: string
  nationalNumber: string
  carrierCode?: string
  ext?: string
  type?: NumberType
  country?: string
  formatInternational?: string
}
