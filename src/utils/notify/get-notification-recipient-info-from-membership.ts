import type { $Enums } from '@prisma/client'

import type { Locale } from '@/constants/locales'

type AccountAlias = {
  id: string
  type: $Enums.AccountAliasType
  contactValue: string
  deletedAt?: Date | null
  isActive?: boolean | null
  verificationStatus?: string | null
}

export default function getNotificationRecipientInfoFromMembership(
  member: {
    account?: {
      id: string
      username: string | null
      fullName: string | null
      nickname: string | null
      locale: Locale | null
      accountAliases: AccountAlias[]
      deletedAt?: Date | null
      isActive?: boolean | null
    } | null
    accountAlias?: AccountAlias | null
  },
  defaultLocale: Locale | null
) {
  const { account, accountAlias } = member

  const toSendNoti: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: Locale | null
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

export function getMemberName({
  account,
  accountAlias,
  accountPlaceholder,
  nickname
}: {
  account?: {
    username: string | null
    fullName: string | null
    nickname: string | null
  } | null
  accountAlias?: AccountAlias | null
  accountPlaceholder?: { name: string | null } | null
  nickname?: string | null
}) {
  return (
    nickname ??
    account?.nickname ??
    account?.fullName ??
    account?.username ??
    accountAlias?.contactValue ??
    accountPlaceholder?.name
  )
}
