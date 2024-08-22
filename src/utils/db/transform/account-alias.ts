import type { AccountAlias as DbAccountAlias } from '@prisma/client'

import type { AccountAlias, AccountBasicInfo } from '@/types/db/index'
import type { NumberType, PhoneNumber } from '@/types/phone-number'

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
    number: contactValue,
    type: valueType as NumberType,
    countryCallingCode: contactGroup!,
    country: contactGroupName ?? undefined,
    nationalNumber: contactBody!,
    carrierCode: contactGroup1 ?? undefined,
    ext: contactExt ?? undefined,
    formatInternational: formatted ?? undefined
  }
}
