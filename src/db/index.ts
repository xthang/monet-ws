import { PrismaClient } from '@prisma/client'
import { fieldEncryptionExtension } from 'prisma-field-encryption'

import { extendedModels } from './extendedModels'
import { extendedQueries } from './extendedQueries'

const db = new PrismaClient()
  .$extends({
    model: { ...extendedModels },
    query: { ...extendedQueries }
  })
  .$extends(fieldEncryptionExtension())

export default db
