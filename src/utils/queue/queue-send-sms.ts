import db from '@/db'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

export default async function queueSendSms(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  smses: {
    category:
      | 'conv-new'
      | 'conv-deleted'
      | 'conv-added-member'
      | 'conv-removed-member'
      | 'remind-payor'
      | 'settled-item'
    to: { accountId?: string; accountAliasId?: string; phoneNumber: string }[]
    text: string
  }[]
) {
  await (db_ ?? db).taskSendSms.createMany({
    data: smses.map(({ text, ...m }) => ({ ...m, content: text, createdBy: 'system' }))
  })
}
