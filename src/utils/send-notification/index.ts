import lodash from 'lodash'

import sendTelegramMessage from './telegram.js'

const throttles: {
  [key: string]: lodash.DebouncedFunc<
    (tag: string, level: 'error' | 'warn' | 'info' | 'log', messages: string[]) => Promise<void>
  >
} = {}
const deleteDebounces: { [key: string]: lodash.DebouncedFunc<() => void> } = {}

export async function sendNotification(
  tag: string,
  level: 'error' | 'warn' | 'info' | 'log',
  messages: string[],
  throttle?: { key: string; wait: number; options?: lodash.ThrottleSettings }
) {
  if (throttle) {
    if (!throttles[throttle.key])
      throttles[throttle.key] = lodash.throttle(
        (tag: string, level: 'error' | 'warn' | 'info' | 'log', messages: string[]) =>
          sendTelegramMessage(tag, level, messages),
        throttle.wait,
        throttle.options ?? { leading: true }
      )
    await throttles[throttle.key](tag, level, messages)

    if (!deleteDebounces[throttle.key])
      deleteDebounces[throttle.key] = lodash.debounce(
        () => {
          delete throttles[throttle.key]
          delete deleteDebounces[throttle.key]
        },
        throttle.wait * 2 + 1000
      )
    deleteDebounces[throttle.key]()
  } else await sendTelegramMessage(tag, level, messages)
}
