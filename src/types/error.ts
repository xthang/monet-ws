export enum ErrorCode {
  WS_STATE_CLOSED = 'WS_STATE_CLOSED'
}

export enum WsErrorCode {
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Do not export this class! Use XError instead!
class BaseError<T = any> extends Error {
  code: string
  details?: T

  constructor(code: string, message: string, details?: T) {
    super(message)
    this.code = code
    this.details = details
  }

  toString() {
    return this.name + ': [' + this.code + '] ' + this.message
  }
}

export class XError extends BaseError {
  declare code: ErrorCode
}

export class WsError extends BaseError {
  declare code: WsErrorCode
}
