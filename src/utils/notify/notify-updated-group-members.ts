import { $Enums, type Group } from '@prisma/client'

import { TextTemplateKey } from '@/constants/data'
import { HOST_NAME, NOTIFIER_SENDER_NAME } from '@/constants/env'
import { DEFAULT_LOCALE, type Locale } from '@/constants/locales'
import type { PrismaTransactionClient } from '@/db/types'

import queueSendEmails from '../queue/queue-send-email'
import queueSendSms from '../queue/queue-send-sms'

export default async function notifyUpdatedGroupMembers(
  group: Pick<Group, 'id' | 'name'>,
  to: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: Locale | null
    channel: 'email' | 'sms'
    address: string
    type: 'added' | 'removed'
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
          TextTemplateKey.CONVO_ADDED_MEMBER_EMAIL_TITLE,
          TextTemplateKey.CONVO_ADDED_MEMBER_EMAIL_CONTENT,
          TextTemplateKey.CONVO_ADDED_MEMBER_SMS_CONTENT,
          TextTemplateKey.CONVO_REMOVED_MEMBER_EMAIL_TITLE,
          TextTemplateKey.CONVO_REMOVED_MEMBER_EMAIL_CONTENT,
          TextTemplateKey.CONVO_REMOVED_MEMBER_SMS_CONTENT
        ]
      }
    }
  })

  if (toEmailAddresses.length)
    await queueSendEmails(
      tx,
      toEmailAddresses.map(({ channel, name, locale, address, type, ...it }) => ({
        category: `conv-${type}-member`,
        from: NOTIFIER_SENDER_NAME,
        to: [{ ...it, emailAddress: address }],
        subject: contentTemplates.find(
          (it) =>
            it.key ===
              (type === 'added'
                ? TextTemplateKey.CONVO_ADDED_MEMBER_EMAIL_TITLE
                : TextTemplateKey.CONVO_REMOVED_MEMBER_EMAIL_TITLE) && it.locale === (locale ?? DEFAULT_LOCALE)
        )!.content,
        text: '',
        html: contentTemplates
          .find(
            (it) =>
              it.key ===
                (type === 'added'
                  ? TextTemplateKey.CONVO_ADDED_MEMBER_EMAIL_CONTENT
                  : TextTemplateKey.CONVO_REMOVED_MEMBER_EMAIL_CONTENT) && it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ? ` <b>${name}</b>` : '')
          .replace(
            '{{group}}',
            `<a href="https://${HOST_NAME}/i/${group.id}"><b>${group.name || '<i>[no name]</i>'}</b></a>`
          )
          .replace('{{group_name}}', `<b>${group.name || '<i>[no name]</i>'}</b>`)
      }))
    )
  if (toPhoneNumbers.length)
    await queueSendSms(
      tx,
      toPhoneNumbers.map(({ channel, name, locale, address, type, ...it }) => ({
        category: `conv-${type}-member`,
        to: [{ ...it, phoneNumber: address }],
        text: contentTemplates
          .find(
            (it) =>
              it.key ===
                (type === 'added'
                  ? TextTemplateKey.CONVO_ADDED_MEMBER_SMS_CONTENT
                  : TextTemplateKey.CONVO_REMOVED_MEMBER_SMS_CONTENT) && it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ? ` ${name}` : '')
          .replace('{{group_name}}', group.name ? ` named ${group.name}` : '')
          .replace('{{group_link}}', `https://${HOST_NAME}/i/${group.id}`)
      }))
    )
}
