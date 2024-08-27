import db from '@/db'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

export default async function queueSendEmails(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  emails: {
    category:
      | 'group-new'
      | 'group-deleted'
      | 'group-added-member'
      | 'group-removed-member'
      | 'group-new-membership-request'
      | 'group-canceled-membership-request'
      | 'group-membership-request-approved'
      | 'group-membership-request-rejected'
      | 'remind-payor'
      | 'settled-item'
    from: string
    to: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    cc?: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    bcc?: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    subject: string
    text: string
    html: string
  }[]
) {
  await (db_ ?? db).taskSendEmail.createMany({
    data: emails.map((em) => ({ ...em, createdBy: 'system' }))
  })
}
