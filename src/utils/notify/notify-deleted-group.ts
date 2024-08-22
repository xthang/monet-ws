import { $Enums, type Group } from '@prisma/client'

import { TextTemplateKey } from '@/constants/data'
import { NOTIFIER_SENDER_NAME } from '@/constants/env'
import { DEFAULT_LOCALE, Locale } from '@/constants/locales'
import type { PrismaTransactionClient } from '@/db/types'

import queueSendEmails from '../queue/queue-send-email'
import queueSendSms from '../queue/queue-send-sms'

export default async function notifyDeletedGroup(
  group: Pick<Group, 'name'>,
  to: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: Locale | null
    channel: 'email' | 'sms'
    address: string
  }[],
  tx: PrismaTransactionClient
) {
  const toEmailAddresses = to.filter((it) => it.channel === 'email')
  const toPhoneNumbers = to.filter((it) => it.channel === 'sms')

  const contentTemplates = await tx.textTemplate.findMany({
    where: {
      type: $Enums.TextTemplateType.textContent,
      key: {
        in: [
          TextTemplateKey.DELETED_CONVO_EMAIL_TITLE,
          TextTemplateKey.DELETED_CONVO_EMAIL_CONTENT,
          TextTemplateKey.DELETED_CONVO_SMS_CONTENT
        ]
      }
    }
  })

  if (toEmailAddresses.length)
    await queueSendEmails(
      tx,
      toEmailAddresses.map(({ channel, name, locale, address, ...it }) => ({
        category: 'conv-deleted',
        from: NOTIFIER_SENDER_NAME,
        to: [{ ...it, emailAddress: address }],
        subject: contentTemplates.find(
          (it) => it.key === TextTemplateKey.DELETED_CONVO_EMAIL_TITLE && it.locale === (locale ?? DEFAULT_LOCALE)
        )!.content,
        text: '',
        html: contentTemplates
          .find(
            (it) => it.key === TextTemplateKey.DELETED_CONVO_EMAIL_CONTENT && it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ? ` <b>${name}</b>` : '')
          .replace('{{group_name}}', `<b>${group.name || '<i>[no name]</i>'}</b>`)
      }))
    )
  if (toPhoneNumbers.length)
    await queueSendSms(
      tx,
      toPhoneNumbers.map(({ channel, name, locale, address, ...it }) => ({
        category: 'conv-deleted',
        to: [{ ...it, phoneNumber: address }],
        text: contentTemplates
          .find(
            (it) => it.key === TextTemplateKey.DELETED_CONVO_SMS_CONTENT && it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ? ` ${name}` : '')
          .replace('{{group_name}}', group.name || '[no name]')
      }))
    )
}
