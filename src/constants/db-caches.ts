import assert from 'assert'

import { $Enums } from '@prisma/client'

import db from '@/db'
import { sleep } from '@/utils/time'

import { TextTemplateKey } from './data'
import { SUPPORTED_LOCALES } from './locales'

export let EMAIL_HTML_TEMPLATE_GENERAL: { [locale: string]: string }

export async function loadDbCaches() {
  await _loadDbCaches(0)
  //
  ;(async () => {
    await sleep(100000)

    let count = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      count++

      try {
        await _loadDbCaches(count)
        await sleep(60000)
      } catch (e) {
        console.error(`!-  [${count}] load Db caches ERROR:`, e)
        await sleep(300000)
      }
    }
  })()
}

async function _loadDbCaches(count: number) {
  const templates = await db.textTemplate.findMany({
    where: {
      type: $Enums.TextTemplateType.textContent,
      key: TextTemplateKey.EMAIL_HTML_TEMPLATE_GENERAL
    }
  })

  EMAIL_HTML_TEMPLATE_GENERAL = Object.fromEntries(
    templates.map(({ locale, content }) => [locale.replace('_', '-'), content])
  )
  console.log(`--  [${count}] loaded EMAIL_HTML_TEMPLATE_GENERAL:`, Object.keys(EMAIL_HTML_TEMPLATE_GENERAL))

  for (const locale of SUPPORTED_LOCALES)
    assert(Object.keys(EMAIL_HTML_TEMPLATE_GENERAL).includes(locale), 'EMAIL_HTML_TEMPLATE_GENERAL: ' + locale)
}
