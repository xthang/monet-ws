import type { $Enums } from '@prisma/client'

import type { SupportedLocale } from '@/constants/locales'

export function fromDbLocale(locale: $Enums.Locale) {
  return locale.replaceAll('_', '-') as SupportedLocale
}
