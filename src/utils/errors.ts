import util from 'util'

export function formatToLog(...data: unknown[]): string {
  return data.map(formatToLog_).join(' ')
}

function formatToLog_(item: unknown): string {
  return util.formatWithOptions({ depth: 5 }, item)

  // let result: string

  // if (item && Array.isArray(item)) {
  //   result = String(item.map(toLogFormat))
  // } else if (item && typeof item === 'object') {
  //   if (item instanceof Error) {
  //     result = item.stack ?? item.toString()

  //     if ('cause' in item && item.cause) result += `\nCaused by: ${item.cause}`

  //     // eslint-disable-next-line no-unused-vars
  //     const { name, message, stack, cause, ...content } = item

  //     if (Object.keys(content).length) result += `\n\n${String(content)}`
  //   } else {
  //     const comps = []

  //     if ('name' in item) comps.push(`${item.name}:`)

  //     if ('code' in item) comps.push(`[${item.code}]`)

  //     if ('errorCode' in item) comps.push(`[errorCode: ${item.errorCode ?? '--'}]`)

  //     if ('message' in item) comps.push(item.message)
  //     else comps.push(String(item))

  //     result = comps.join(' ')

  //     if ('reason' in item && item.reason) result += `\nReason: ${item.reason}`
  //     if ('errorReason' in item && item.errorReason) result += `\nError Reason: ${item.errorReason}`
  //     if ('cause' in item && item.cause) result += `\nCaused by: ${String(item.cause)}`

  //     if ('stack' in item && item.stack) result += `\n\n${item.stack}`

  //     if ('innerError' in item && item.innerError) result += `\n\nInner Error: ${toLogFormat(item.innerError)}`
  //   }
  // } else {
  //   result = String(item)
  // }

  // return result
}
