import type { AccountBasicInfo } from '@/types/db'

export function getAccountName(account: Partial<AccountBasicInfo>, include?: { nickname?: false; username?: false }) {
  return (
    (include?.nickname !== false ? account.nickname : undefined) ??
    account.fullName ??
    (account.firstName || account.lastName ? `${account.firstName ?? ''} ${account.lastName ?? ''}` : null) ??
    (include?.username !== false ? account.username : undefined)
  )
}

export function getMemberName({
  account,
  accountAlias,
  accountPlaceholder,
  nickname
}: {
  account?: AccountBasicInfo | null
  accountAlias?: { contactValue: string; formatted: string | null } | null
  accountPlaceholder?: { name: string | null } | null
  nickname?: string | null
}) {
  return (
    nickname ??
    (account && getAccountName(account)) ??
    accountAlias?.formatted ??
    accountAlias?.contactValue ??
    accountPlaceholder?.name
  )
}
