import assert from 'assert'

import jwt from 'jsonwebtoken'

import { CLERK_PUBLIC_KEY } from '@/constants/env'

export function verifyToken(token: string) {
  try {
    const verified = jwt.verify(token, CLERK_PUBLIC_KEY, { algorithms: ['RS256'] })

    if (typeof verified === 'string') {
      console.error(`!-  Failed to verify Clerk token: verified is:`, verified)
      return null
    } else {
      const { sub: userId, org_id: ordId } = verified
      assert(userId, 'userId')
      return { userId, ordId }
    }
  } catch (err: any) {
    console.error(`!-  Failed to verify Clerk token:`, err.message)
    return null
  }
}
