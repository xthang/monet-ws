import type { GroupMembership } from '@prisma/client'

import type { AccountBasicInfo, AccountAlias, AccountPlaceholder } from './db/index'

// values which might be members of a group or not (is deleted from that group)
type ParticipantMember = Pick<
  GroupMembership,
  | 'id'
  | 'accountId'
  | 'accountAliasId'
  | 'accountPlaceholderId'
  | 'accountOrPlaceholderId'
  | 'role'
  | 'nickname'
  | 'order'
  // | 'createdAt'
  // | 'createdBy'
  // | 'updatedAt'
  // | 'updatedBy'
  | 'deletedAt'
  | 'deletedBy'
> & {
  account: AccountBasicInfo | null
  accountAlias: AccountAlias | null
  accountPlaceholder: AccountPlaceholder | null

  notInOrg: boolean | undefined
}
