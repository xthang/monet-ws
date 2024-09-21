import type { $Enums } from '@prisma/client'

import type { SupportedLocale } from '@/constants/locales'
import type { AccountBasicInfo } from '@/types/db'

import { getMemberName } from '../get-name-display'

type AccountAlias = {
  id: string
  type: $Enums.AccountAliasType
  contactValue: string
  formatted: string | null
  deletedAt?: Date | null
  isActive?: boolean | null
  verificationStatus?: string | null
}

export default function getNotificationRecipientInfoFromMembership(
  member: {
    account?:
      | (AccountBasicInfo & {
          locale: SupportedLocale | null
          accountAliases: AccountAlias[]
          deletedAt?: Date | null
          isActive?: boolean | null
        })
      | null
    accountAlias?: AccountAlias | null
  },
  defaultLocale: SupportedLocale | null
) {
  const { account, accountAlias } = member

  const toSendNoti: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: SupportedLocale | null
    channel: 'email' | 'sms'
    address: string
  }[] = []

  if (account && !account.deletedAt && (account.isActive === undefined || account.isActive)) {
    for (const accountAlias of account.accountAliases) {
      if (
        !accountAlias.deletedAt &&
        (accountAlias.isActive === undefined || accountAlias.isActive) &&
        (accountAlias.verificationStatus === undefined || accountAlias.verificationStatus === 'verified') &&
        (accountAlias.type === 'emailAddr' || accountAlias.type === 'phoneNo')
      )
        toSendNoti.push({
          accountId: account.id,
          accountAliasId: accountAlias.id,
          name: getMemberName({ account, accountAlias }) ?? undefined,
          locale: account.locale ?? defaultLocale,
          channel: accountAlias.type === 'emailAddr' ? 'email' : 'sms',
          address: accountAlias.contactValue
        })
    }
  }

  if (
    accountAlias &&
    !accountAlias.deletedAt &&
    (accountAlias.isActive === undefined || accountAlias.isActive) &&
    (accountAlias.type === 'emailAddr' || accountAlias.type === 'phoneNo')
  )
    toSendNoti.push({
      accountId: account?.id,
      accountAliasId: accountAlias.id,
      name: getMemberName({ account, accountAlias }) ?? undefined,
      locale: account?.locale ?? defaultLocale,
      channel: accountAlias.type === 'emailAddr' ? 'email' : 'sms',
      address: accountAlias.contactValue
    })

  return toSendNoti
}
