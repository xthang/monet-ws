/**
 * Make all properties in T required & non-nullable
 */
type RequiredNonNullableAllProps<T> = {
  [P in keyof T]-?: NonNullable<T[P]>
}

/**
 * Make all properties in T nullable
 */
type NullableAllProps<T> = {
  [P in keyof T]: T[P] | null
}

/**
 * Make some properties in T required
 */
type RequiredProps<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}

/**
 * Make some properties in T required & non-nullable
 */
type RequiredNonNullableProps<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>
}

/**
 * Make some properties in T nullable
 */
type NullableProps<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? T[P] | null : T[P]
}

/**
 * Make some properties in T optional
 */
type PartialProps<T, K extends keyof T> = Omit<T, K> & {
  [P in K]?: T[P]
}

/**
 * Make all properties in T optional except for some
 */
type PartialExcept<T, K extends keyof T> = {
  [P in Exclude<keyof T, K>]?: T[P]
} & {
  [P in K]: T[P]
}

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

declare namespace NodeJS {
  interface ProcessEnv {
    readonly ENVIRONMENT: 'dev' | 'staging' | 'production' | 'test'
  }
}
