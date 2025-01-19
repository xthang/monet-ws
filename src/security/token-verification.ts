import assert from 'assert'

import jwt from 'jsonwebtoken'

import { JWT_PUBLIC_KEY } from '@/constants/env'

export function verifyToken(token: string) {
  try {
    const verified = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })

    if (typeof verified === 'string') {
      console.error(`!-  Failed to verify Clerk token: verified is:`, verified)
      return null
    } else {
      const { account_id: accountId, org_id: orgId } = verified
      assert(accountId, 'accountId')
      return { accountId, orgId }
    }
  } catch (err: any) {
    console.error(`!-  Failed to verify Access token:`, err.message)
    return null
  }
}
