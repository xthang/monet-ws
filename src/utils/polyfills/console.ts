import { isDevEnv } from '@/constants/env'

import { formatToLog } from '../errors'
import { sendNotification } from '../send-notification/index'

// ----------

console.dev = (...data: any[]) => {
  if (isDevEnv) console.debug(...data)
}

console.errorNotSend = console.error
console.warnNotSend = console.warn

console.error = (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.errorNotSend(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    sendNotification('console', 'error', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
console.errorAsync = async (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.errorNotSend(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    await sendNotification('console', 'error', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
console.warn = (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.warnNotSend(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    sendNotification('console', 'warn', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
console.warnAsync = async (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.warnNotSend(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    await sendNotification('console', 'warn', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
console.logAndSend = (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.log(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    sendNotification('console', 'log', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
console.logAndSendAsync = async (...data: any[]) => {
  const [options, ...d] = data
  const hasOptions = options.throttle != undefined || options.sendNoti != undefined

  console.log(...(hasOptions ? d : data))

  if (options.sendNoti ?? true)
    await sendNotification('console', 'log', [formatToLog(...(hasOptions ? d : data))], options.throttle)
}
