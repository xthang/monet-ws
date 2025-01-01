import type { WsError } from '@/types/error'

export function transformError(e: Error) {
  return {
    code: (e as WsError).code ?? 'INTERNAL_ERROR',
    message: e.message,
    details: (e as WsError).details ?? JSON.parse(JSON.stringify(e))
  }
}
