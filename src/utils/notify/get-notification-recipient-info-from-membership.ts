import type { $Enums } from '@prisma/client'

import type { Locale } from '@/constants/locales'

type AccountAlias = { id: string; type: $Enums.AccountAliasType; contactValue: string }

export default function getNotificationRecipientInfoFromMembership(
  member: {
    accountId?: string | null
    account?: {
      username: string | null
      fullName: string | null
      nickname: string | null
      locale: Locale | null
      accountAliases: AccountAlias[]
    } | null
    accountAliasId?: string | null
    accountAlias?: AccountAlias | null
  },
  defaultLocale: Locale | null
) {
  const { accountId, account, accountAliasId, accountAlias } = member

  const toSendNoti: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: Locale | null
    channel: 'email' | 'sms'
    address: string
  }[] = []

  if (account) {
    for (const accountAlias of account.accountAliases) {
      if (accountAlias.type === 'emailAddr' || accountAlias.type === 'phoneNo')
        toSendNoti.push({
          accountId: accountId ?? undefined,
          accountAliasId: accountAlias.id,
          name: getMemberName({ account, accountAlias }) ?? undefined,
          locale: account.locale ?? defaultLocale,
          channel: accountAlias.type === 'emailAddr' ? 'email' : 'sms',
          address: accountAlias.contactValue
        })
    }
  }

  if (accountAlias && (accountAlias.type === 'emailAddr' || accountAlias.type === 'phoneNo'))
    toSendNoti.push({
      accountId: accountId ?? undefined,
      accountAliasId: accountAliasId ?? undefined,
      name: getMemberName({ account, accountAlias }) ?? undefined,
      locale: account?.locale ?? defaultLocale,
      channel: accountAlias.type === 'emailAddr' ? 'email' : 'sms',
      address: accountAlias.contactValue
    })

  return toSendNoti
}

export function getMemberName({
  account,
  accountAlias,
  accountPlaceholder
}: {
  account?: {
    username: string | null
    fullName: string | null
    nickname: string | null
  } | null
  accountAlias?: AccountAlias | null
  accountPlaceholder?: { name: string | null } | null
}) {
  return (
    account?.nickname ??
    account?.fullName ??
    account?.username ??
    accountAlias?.contactValue ??
    accountPlaceholder?.name
  )
}
