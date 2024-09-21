import { $Enums, type Group } from '@prisma/client'

import { TextTemplateKey } from '@/constants/data'
import { HOST_NAME, NOTIFIER_SENDER_NAME } from '@/constants/env'
import { DEFAULT_LOCALE, type SupportedLocale } from '@/constants/locales'
import type { PrismaTransactionClient } from '@/db/types'
import queueSendEmails from '@/utils/queue/queue-send-email'
import queueSendSms from '@/utils/queue/queue-send-sms'

export default async function notifyHandledGroupMembershipRequest(
  group: Pick<Group, 'id' | 'name'>,
  to: {
    accountId?: string
    accountAliasId?: string
    name?: string
    locale?: SupportedLocale | null
    channel: 'email' | 'sms'
    address: string
  }[],
  action: 'approve' | 'reject',
  tx: PrismaTransactionClient
) {
  const toEmailAddresses = to.filter((it) => it.channel === 'email')
  const toPhoneNumbers = to.filter((it) => it.channel === 'sms')

  const contentTemplates = await tx.textTemplate.findMany({
    where: {
      type: $Enums.TextTemplateType.textContent,
      key: {
        in:
          action === 'approve'
            ? [
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__EMAIL_TITLE,
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__EMAIL_CONTENT,
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__SMS_CONTENT
              ]
            : [
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__EMAIL_TITLE,
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__EMAIL_CONTENT,
                TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__SMS_CONTENT
              ]
      }
    }
  })

  if (toEmailAddresses.length)
    await queueSendEmails(
      tx,
      toEmailAddresses.map(({ channel, name, locale, address, ...it }) => ({
        category: `group-membership-request-${action === 'approve' ? 'approved' : 'rejected'}`,
        from: NOTIFIER_SENDER_NAME,
        to: [{ ...it, emailAddress: address }],
        locale: locale ?? DEFAULT_LOCALE,
        subject: contentTemplates.find(
          (it) =>
            it.key ===
              (action === 'approve'
                ? TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__EMAIL_TITLE
                : TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__EMAIL_TITLE) &&
            it.locale === (locale ?? DEFAULT_LOCALE)
        )!.content,
        text: '',
        html: contentTemplates
          .find(
            (it) =>
              it.key ===
                (action === 'approve'
                  ? TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__EMAIL_CONTENT
                  : TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__EMAIL_CONTENT) &&
              it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ?? '[-]')
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
      toPhoneNumbers.map(({ channel, name, locale, address, ...it }) => ({
        category: `group-membership-request-${action === 'approve' ? 'approved' : 'rejected'}`,
        to: [{ ...it, phoneNumber: address }],
        locale: locale ?? DEFAULT_LOCALE,
        text: contentTemplates
          .find(
            (it) =>
              it.key ===
                (action === 'approve'
                  ? TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_APPROVED__SMS_CONTENT
                  : TextTemplateKey.GROUP_MEMBERSHIP_REQUEST_REJECTED__SMS_CONTENT) &&
              it.locale === (locale ?? DEFAULT_LOCALE)
          )!
          .content.replace('{{member_name}}', name ?? '[-]')
          .replace('{{group_name}}', group.name ? `: ${group.name}` : '')
          .replace('{{group_link}}', `https://${HOST_NAME}/i/${group.id}`)
      }))
    )
}
