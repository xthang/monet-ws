export enum ErrorCode {
  WS_STATE_CLOSED = 'WS_STATE_CLOSED'
}

export enum WsHttpCode {
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export enum WsErrorCode {
  INVALID_REQUEST_EVENT = 'INVALID_REQUEST_EVENT',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  INVALID_MEMBERSHIPS = 'INVALID_MEMBERSHIPS',
  GROUP_MEMBERS_MAXIMUM_REACHED = 'GROUP_MEMBERS_MAXIMUM_REACHED',
  NOT_ALLOWED = 'NOT_ALLOWED',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR'
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

export class WsError<T = any> extends Error {
  httpCode: WsHttpCode
  code: WsErrorCode | null
  details?: T

  constructor(httpCode: WsHttpCode, code: WsErrorCode | null, message: string, details?: T) {
    super(message)
    this.httpCode = httpCode
    this.code = code
    this.details = details
  }

  toString() {
    return this.name + ': [' + this.httpCode + '-' + this.code + '] ' + this.message
  }
}
