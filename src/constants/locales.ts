import { $Enums } from '@prisma/client'

export const LOCALES = [
  'en-US',
  'af-ZA',
  'ar-SA',
  'ca-ES',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'es-ES',
  'fi-FI',
  'fr-FR',
  'he-IL',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'no-NO',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'sr-SP',
  'sv-SE',
  'sw-TZ',
  'tr-TR',
  'uk-UA',
  'vi',
  'zh-CN',
  'zh-TW'
] as const
export type Locale = (typeof LOCALES)[number]

export const SUPPORTED_LOCALES = [
  // order as they appear in the language dropdown
  'en-US',
  'vi'
] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE = 'en-US'
export const DEFAULT_DB_LOCALE = $Enums.Locale.en_US
