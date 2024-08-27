import { msg } from '@lingui/macro'
import type { Group } from '@prisma/client'
import { $Enums } from '@prisma/client'

import { TextTemplateKey } from '@/constants/data'
import { HOST_NAME, NOTIFIER_SENDER_NAME } from '@/constants/env'
import { DEFAULT_LOCALE, loadI18n, SupportedLocale, type Locale } from '@/constants/locales'
import type { PrismaClient, PrismaTransactionClient } from '@/db/types'

import queueSendEmails from '../queue/queue-send-email'
import queueSendSms from '../queue/queue-send-sms'

export default async function notifySettleItems(
  db: PrismaClient | PrismaTransactionClient,
  group: Pick<Group, 'id' | 'name'>,
  tabId: string,
  to: {
    accountId?: string
    accountAliasId?: string
    role: 'payor' | 'payee'
    name?: string
    locale?: Locale | null
    channel: 'email' | 'sms'
    address: string
  }[],
  payment: { payor: { name: string }; payee: { name: string }; currency: string; amount: number; messageId: string }
) {
  const toEmailAddresses = to.filter((it) => it.channel === 'email')
  const toPhoneNumbers = to.filter((it) => it.channel === 'sms')

  const contentTemplates = await db.textTemplate.findMany({
    where: {
      type: $Enums.TextTemplateType.textContent,
      key: {
        in: [
          TextTemplateKey.SETTLED_ITEM__EMAIL_TITLE,
          TextTemplateKey.SETTLED_ITEM__EMAIL_CONTENT,
          TextTemplateKey.SETTLED_ITEM__SMS_CONTENT
        ]
      }
    }
  })

  if (toEmailAddresses.length) {
    await queueSendEmails(
      db,
      await Promise.all(
        toEmailAddresses.map(async ({ channel, role, name, locale, address, ...it }) => {
          const locale_ = (locale ?? DEFAULT_LOCALE) as SupportedLocale
          const i18n = await loadI18n(locale_)

          return {
            category: 'settled-item',
            from: NOTIFIER_SENDER_NAME,
            to: [{ ...it, emailAddress: address }],
            subject: contentTemplates.find(
              (it) => it.key === TextTemplateKey.SETTLED_ITEM__EMAIL_TITLE && it.locale === locale_
            )!.content,
            text: '',
            html: contentTemplates
              .find((it) => it.key === TextTemplateKey.SETTLED_ITEM__EMAIL_CONTENT && it.locale === locale_)!
              .content.replace('{{member_name}}', name ? ` <b>${name}</b>` : '')
              .replace(
                '{{group}}',
                `<a href="https://${HOST_NAME}/i/${group.id}?tab=${tabId}&mgsId=${payment.messageId}"><b>${group.name || '<i>[no name]</i>'}</b></a>`
              )
              .replace('{{payor_}}', i18n._(role === 'payor' ? msg`<i>You</i> have` : msg`${payment.payor.name} has`))
              .replace('{{payee}}', role === 'payee' ? `<i>${i18n._(msg`you`)}</i>` : payment.payee.name)
              .replace('{{currency}}', payment.currency)
              .replace('{{amount}}', payment.amount.format(locale ?? undefined))
          }
        })
      )
    )
  }
  if (toPhoneNumbers.length) {
    await queueSendSms(
      db,
      await Promise.all(
        toPhoneNumbers.map(async ({ channel, role, name, locale, address, ...it }) => {
          const locale_ = (locale ?? DEFAULT_LOCALE) as SupportedLocale
          const i18n = await loadI18n(locale_)

          return {
            category: 'settled-item',
            to: [{ ...it, phoneNumber: address }],
            text: contentTemplates
              .find((it) => it.key === TextTemplateKey.SETTLED_ITEM__SMS_CONTENT && it.locale === locale_)!
              .content.replace('{{member_name}}', name ? ` ${name}` : '')
              .replace('{{group_name}}', group.name || '[no name]')
              .replace('{{group_link}}', `https://${HOST_NAME}/i/${group.id}?tab=${tabId}&mgsId=${payment.messageId}`)
              .replace('{{payor_}}', i18n._(role === 'payor' ? msg`You have` : msg`${payment.payor.name} has`))
              .replace('{{payee}}', role === 'payee' ? i18n._(msg`you`) : payment.payee.name)
              .replace('{{currency}}', payment.currency)
              .replace('{{amount}}', payment.amount.format(locale ?? undefined))
          }
        })
      )
    )
  }
}
