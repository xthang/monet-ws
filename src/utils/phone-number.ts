import parsePhoneNumber, { type PhoneNumber } from 'libphonenumber-js'

export function parsePhoneNo(fullText: string): PhoneNumber | undefined
export function parsePhoneNo(countryCode: string, main: string): PhoneNumber | undefined
export function parsePhoneNo(fullTextOrCountryCode: string, main?: string) {
  return parsePhoneNumber(fullTextOrCountryCode + (main ?? ''))
}
