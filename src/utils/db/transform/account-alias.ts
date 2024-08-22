import type { Prisma, AccountAlias as DbAccountAlias } from '@prisma/client'
import { AccountAliasType } from '@prisma/client'
import type {
  CarrierCode,
  CountryCallingCode,
  CountryCode,
  E164Number,
  Extension,
  NationalNumber,
  NumberType
} from 'libphonenumber-js'

import type { AccountAlias, AccountBasicInfo } from '@/types/db/index'
import type { PhoneNumber } from '@/types/phone-number.d'

export function transformAccountAlias<
  A extends AccountBasicInfo,
  T extends Pick<
    DbAccountAlias,
    | 'id'
    | 'accountId'
    | 'type'
    | 'rawValue'
    | 'contactValue'
    | 'valueType'
    | 'contactGroup'
    | 'contactGroupName'
    | 'contactGroup1'
    | 'contactBody'
    | 'contactExt'
    | 'formatted'
    | 'verificationStatus'
  > & { account: A | null }
>(accountAlias: T, orgMemberAccountIds: string[] | undefined): AccountAlias {
  const { type, contactValue, formatted, verificationStatus, account, ...alias } = accountAlias
  return {
    ...alias,
    verificationStatus,
    ...(account &&
      (verificationStatus === 'verified' && (!orgMemberAccountIds || orgMemberAccountIds.includes(account.id))
        ? { account }
        : { account_: { username: account.username } })),
    ...(type === 'emailAddr'
      ? ({ type: 'email-addr', value: contactValue } as const)
      : ({ type: 'phone-no', value: transformDbAliasToPhoneNo({ ...accountAlias, formatted }) } as const))
  }
}

export function transformPhoneNoToDbAlias(
  raw: string,
  {
    type,
    number,
    countryCallingCode,
    country,
    carrierCode,
    nationalNumber,
    ext,
    formatInternational
  }: Pick<PhoneNumber, 'type' | 'formatInternational'> & {
    number: string
    countryCallingCode: string
    country?: string | undefined
    carrierCode?: string | undefined
    nationalNumber: string
    ext?: string | undefined
  }
): Pick<
  Prisma.AccountAliasCreateInput,
  | 'type'
  | 'rawValue'
  | 'contactValue'
  | 'valueType'
  | 'contactGroup'
  | 'contactGroupName'
  | 'contactGroup1'
  | 'contactBody'
  | 'contactExt'
  | 'formatted'
> {
  return {
    type: AccountAliasType.phoneNo,
    rawValue: raw,
    contactValue: number,
    valueType: type,
    contactGroup: countryCallingCode,
    contactGroupName: country,
    contactGroup1: carrierCode,
    contactExt: ext,
    contactBody: nationalNumber,
    formatted: formatInternational
  } as const
}

function transformDbAliasToPhoneNo({
  contactValue,
  valueType,
  contactGroup,
  contactGroupName,
  contactGroup1,
  contactBody,
  contactExt,
  formatted
}: Pick<
  DbAccountAlias,
  | 'contactValue'
  | 'valueType'
  | 'contactGroup'
  | 'contactGroupName'
  | 'contactGroup1'
  | 'contactBody'
  | 'contactExt'
  | 'formatted'
>): PhoneNumber {
  return {
    number: contactValue as E164Number,
    type: valueType as NumberType,
    countryCallingCode: contactGroup! as CountryCallingCode,
    country: contactGroupName as CountryCode | undefined,
    nationalNumber: contactBody! as NationalNumber,
    carrierCode: (contactGroup1 as CarrierCode | null) ?? undefined,
    ext: (contactExt as Extension | null) ?? undefined,
    formatInternational: formatted ?? undefined
  }
}
