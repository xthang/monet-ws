import { $Enums, type Group } from '@prisma/client'

import { TextTemplateKey } from '@/constants/data'
import { HOST_NAME, NOTIFIER_SENDER_NAME } from '@/constants/env'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/constants/locales'
import type { PrismaTransactionClient } from '@/db/types'
import { fromDbLocale } from '@/utils/db/transform/locale'
import queueSendEmails from '@/utils/queue/queue-send-email'
import queueSendSms from '@/utils/queue/queue-send-sms'

export default async function notifyUpdatedGroupMembers(
  group: Pick<Group, 'id' | 'name'>,
  to: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: SupportedLocale | null
    channel: 'email' | 'sms'
    address: string
    type: 'added' | 'removed'
  }[],
  tx: PrismaTransactionClient
) {
  const toEmailAddresses = to.filter((it) => it.channel === 'email')
  const toPhoneNumbers = to.filter((it) => it.channel === 'sms')

  const contentTemplates = (
    await tx.textTemplate.findMany({
      where: {
        type: $Enums.TextTemplateType.textContent,
        key: {
          in: [
            TextTemplateKey.GROUP_ADDED_MEMBER__EMAIL_TITLE,
            TextTemplateKey.GROUP_ADDED_MEMBER__EMAIL_CONTENT,
            TextTemplateKey.GROUP_ADDED_MEMBER__SMS_CONTENT,
            TextTemplateKey.GROUP_REMOVED_MEMBER__EMAIL_TITLE,
            TextTemplateKey.GROUP_REMOVED_MEMBER__EMAIL_CONTENT,
            TextTemplateKey.GROUP_REMOVED_MEMBER__SMS_CONTENT
          ]
        },
        status: $Enums.TextTemplateStatus.active
      },
      select: { key: true, locale: true, content: true }
    })
  ).map(({ locale, ...others }) => ({ locale: fromDbLocale(locale), ...others }))

  if (toEmailAddresses.length)
    await queueSendEmails(
      tx,
      toEmailAddresses.map(({ channel, name, locale, address, type, ...it }) => {
        const locale_ = locale ?? DEFAULT_LOCALE

        return {
          category: `group-${type}-member`,
          from: NOTIFIER_SENDER_NAME,
          to: [{ ...it, emailAddress: address }],
          locale: locale_,
          subject: contentTemplates.find(
            (it) =>
              it.key ===
                (type === 'added'
                  ? TextTemplateKey.GROUP_ADDED_MEMBER__EMAIL_TITLE
                  : TextTemplateKey.GROUP_REMOVED_MEMBER__EMAIL_TITLE) && it.locale === locale_
          )!.content,
          text: '',
          html: contentTemplates
            .find(
              (it) =>
                it.key ===
                  (type === 'added'
                    ? TextTemplateKey.GROUP_ADDED_MEMBER__EMAIL_CONTENT
                    : TextTemplateKey.GROUP_REMOVED_MEMBER__EMAIL_CONTENT) && it.locale === locale_
            )!
            .content.replace('{{member_name}}', name ? ` <b>${name}</b>` : '')
            .replace(
              '{{group}}',
              `<a href="https://${HOST_NAME}/i/${group.id}"><b>${group.name || '<i>[no name]</i>'}</b></a>`
            )
            .replace('{{group_name}}', `<b>${group.name || '<i>[no name]</i>'}</b>`)
        }
      })
    )
  if (toPhoneNumbers.length)
    await queueSendSms(
      tx,
      toPhoneNumbers.map(({ channel, name, locale, address, type, ...it }) => {
        const locale_ = locale ?? DEFAULT_LOCALE

        return {
          category: `group-${type}-member`,
          to: [{ ...it, phoneNumber: address }],
          locale: locale_,
          text: contentTemplates
            .find(
              (it) =>
                it.key ===
                  (type === 'added'
                    ? TextTemplateKey.GROUP_ADDED_MEMBER__SMS_CONTENT
                    : TextTemplateKey.GROUP_REMOVED_MEMBER__SMS_CONTENT) && it.locale === locale_
            )!
            .content.replace('{{member_name}}', name ? ` ${name}` : '')
            .replace('{{group_name}}', group.name ? `: ${group.name}` : '')
            .replace('{{group_link}}', `https://${HOST_NAME}/i/${group.id}`)
        }
      })
    )
}
