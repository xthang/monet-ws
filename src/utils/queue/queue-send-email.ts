import db from '@/db/index'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

export default async function queueSendEmails(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  emails: {
    category: 'conv-new' | 'conv-deleted' | 'conv-added-member' | 'conv-removed-member' | 'payor' | 'settled-item'
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
