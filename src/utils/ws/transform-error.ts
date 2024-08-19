export function transformError(e: any) {
  return {
    code: e.code ?? 'INTERNAL_ERROR',
    message: e.message,
    details: e.details ?? JSON.parse(JSON.stringify(e))
  }
}
