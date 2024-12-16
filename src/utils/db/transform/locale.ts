import type { $Enums } from '@prisma/client'

import type { Locale } from '@/constants/locales'

export function fromDbLocale(locale: $Enums.Locale) {
  return locale.replaceAll('_', '-') as Locale
}

export function toDbLocale(locale: Locale) {
  return locale.replaceAll('-', '_') as $Enums.Locale
}
