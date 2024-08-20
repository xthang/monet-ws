import { XError } from '@/types/error'

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function awaitWithinTime<T>(fnc: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fnc,
    (async () => {
      await sleep(ms)
      throw new XError('PROMISE_TIME_OUT', 'promise timed out')
    })()
  ])
}
