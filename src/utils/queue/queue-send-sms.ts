import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

import { toDbLocale } from '../db/transform/locale'

export default async function queueSendSms(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  smses: {
    category: // | 'group-new'
    | 'group-deleted'
      | 'group-added-member'
      | 'group-removed-member'
      | 'group-new-membership-request'
      | 'group-canceled-membership-request'
      | 'group-membership-request-approved'
      | 'group-membership-request-rejected'
      // | 'remind-payor'
      | 'settled-item'
    to: { accountId?: string; accountAliasId?: string; phoneNumber: string }[]
    locale: SupportedLocale
    text: string
  }[]
) {
  await (db_ ?? db).taskSendSms.createMany({
    data: smses.map(({ locale, text, ...m }) => ({
      ...m,
      locale: toDbLocale(locale),
      content: text,
      createdBy: 'system'
    }))
  })
}
