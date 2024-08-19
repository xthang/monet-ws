import type { ConversationMembership } from '@prisma/client'

import type { AccountBasicInfo, AccountAlias, AccountPlaceholder } from './db/index.js'

// values which might be members of a conversation or not (is deleted from that conversation)
type ParticipantMember = Pick<
  ConversationMembership,
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
