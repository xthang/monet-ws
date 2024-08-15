import { PrismaClient } from '@prisma/client'

import { extendedModels } from './extendedModels.js'
import { extendedQueries } from './extendedQueries.js'

const db = new PrismaClient().$extends({
  model: { ...extendedModels },
  query: { ...extendedQueries }
})

export default db
