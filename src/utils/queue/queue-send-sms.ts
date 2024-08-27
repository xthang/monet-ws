import db from '@/db'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

export default async function queueSendSms(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  smses: {
    category:
      | 'group-new'
      | 'group-deleted'
      | 'group-added-member'
      | 'group-removed-member'
      | 'group-new-membership-request'
      | 'group-canceled-membership-request'
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
