import PQueue from 'p-queue'

export async function checkTelegramBot() {
  console.log('--  Checking Telegram Bot ...')

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
    if (!BOT_TOKEN) return

    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
    console.log(`<-- Telegram.getMe - resp:`, resp.status, '|', await resp.text())
  } catch (e) {
    console.errorNotSend(`!-- Telegram.getMe - ERROR:`, e)
  }
}

export async function checkTelegramBotUpdates() {
  console.log('--  Checking Telegram Bot updates ...')

  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
    if (!BOT_TOKEN) return

    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
    console.log(`<-- Telegram.getUpdates - resp:`, resp.status, '|', await resp.text())
  } catch (e) {
    console.errorNotSend(`!-- Telegram.getUpdates - ERROR:`, e)
  }
}

const sendQueue = new PQueue({ concurrency: 1 })

export default async function sendTelegramMessage(
  tag: string,
  level: 'error' | 'warn' | 'info' | 'log',
  messages: string[]
) {
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID
  if (!CHAT_ID) return

  await sendTelegramMessageToGroup(tag, CHAT_ID, level, messages)
}

export async function sendTelegramMessageToGroup(
  tag: string,
  chatId: string,
  level: 'error' | 'warn' | 'info' | 'log',
  messages: string[]
) {
  await sendQueue.add(async () => {
    try {
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
      if (!BOT_TOKEN) return

      const url = new URL(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`)
      const params = {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `<b>[${process.env.SERVER_ID}]</b> <b>[${process.env.name ?? '--'}]</b> <b>[${tag}]</b> [<i>${level}</i>] ${messages
          .map((it) =>
            it
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;')
              .replaceAll('"', '&quot;')
              .replaceAll("'", '&#039;')
          )
          .join('<br/>')}`.slice(0, 4096),
        disable_web_page_preview: 'true'
      }
      url.search = new URLSearchParams(params).toString()

      const resp = await fetch(url, { method: 'get' })
      if (!resp.ok)
        console.warnNotSend(
          `<-- sendTelegramMessage - resp:`,
          resp.status,
          '\n| msg:\n',
          messages,
          '\n| resp:\n',
          await resp.text()
        )
    } catch (e) {
      console.errorNotSend(`!-- sendTelegramMessage - ERROR:`, e)
    }
  })
}
