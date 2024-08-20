import assert from 'assert'

import * as dotenv from 'dotenv'

const dotenvs: string[] = ['.env']

const { error: dotenvConfigError } = dotenv.config()
if (dotenvConfigError) throw dotenvConfigError

const runEnv = process.env.ENV_FILE ?? 'development'
for (const f of [`.env.${runEnv}`, `.env.${runEnv}.local`, '.env.local']) {
  const { error: dotenvConfigError } = dotenv.config({ path: f, override: true })
  if (!dotenvConfigError) dotenvs.push(f)
}
console.log('--  Environments:', dotenvs.join(', '))

export function getEnvironmentVarInt(varname: string, defaultvalue?: number | undefined) {
  const result = process.env[varname]
  if (result !== undefined) return parseInt(result, 10)
  else return defaultvalue
}

export const ENVIRONMENT = process.env.ENVIRONMENT
assert(ENVIRONMENT, 'ENVIRONMENT')
export const isProductionEnv = ENVIRONMENT == 'production'
export const isStagingEnv = ENVIRONMENT == 'staging'
export const isDevEnv = [undefined, '', 'local', 'development', 'dev'].includes(ENVIRONMENT)

export const PORT = parseInt(process.env.PORT!)
assert(!isNaN(PORT), 'PORT')

export const HOST_NAME = process.env.HOST_NAME!
assert(HOST_NAME, 'HOST_NAME')

export const NOTIFIER_SENDER_NAME = process.env.NOTIFIER_SENDER_NAME!
assert(NOTIFIER_SENDER_NAME, 'NOTIFIER_SENDER_NAME')

export const CLERK_PUBLIC_KEY = process.env.CLERK_PUBLIC_KEY!
assert(CLERK_PUBLIC_KEY, 'CLERK_PUBLIC_KEY')
