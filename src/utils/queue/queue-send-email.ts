import type { $Enums } from '@prisma/client'

import { EMAIL_HTML_TEMPLATE_GENERAL } from '@/constants/db-caches'
import type { SupportedLocale } from '@/constants/locales'
import db from '@/db'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

export default async function queueSendEmails(
  db_: PrismaClient | PrismaTransactionClient | undefined,
  emails: {
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
    from: string
    to: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    cc?: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    bcc?: { accountId?: string; accountAliasId?: string; emailAddress: string }[]
    locale: SupportedLocale
    subject: string
    text: string
    html: string
  }[]
) {
  await (db_ ?? db).taskSendEmail.createMany({
    data: emails.map(({ locale, html, ...em }) => ({
      ...em,
      locale: locale.replaceAll('-', '_') as $Enums.Locale,
      html: EMAIL_HTML_TEMPLATE_GENERAL[locale].replace('{{content}}', html),
      createdBy: 'system'
    }))
  })
}
