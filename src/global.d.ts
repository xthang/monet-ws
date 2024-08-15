interface Number {
  format(locale: Intl.LocalesArgument, maximumFractionDigits?: number): string
}

interface Array<T> {
  random(): T | undefined
}

interface Date {
  toISOLocalString(): string
}

interface Math {
  maxBig<T extends bigint = bigint>(...values: T[]): T
}
// We want to extend various globals, so we need to use interfaces.
interface Console {
  dev(...data: any[]): void

  errorAsync(...data: any[]): Promise<void>
  warnAsync(...data: any[]): Promise<void>

  errorNotSend(...data: any[]): void
  warnNotSend(...data: any[]): void
  logAndSend(...data: any[]): void
  logAndSendAsync(...data: any[]): Promise<void>
}

namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_ENVIRONMENT: 'dev' | 'staging' | 'production' | 'test'
  }
}
