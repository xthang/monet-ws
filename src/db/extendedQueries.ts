type FindManyArgs = {
  args: {
    where?: any | null
    orderBy?: any | null
    include?: { [model: string]: boolean | { where?: any; orderBy?: any; select?: any } } | null
  }
  query: any
}

type ExtendedQueryFunction = {
  findMany({ args, query }: FindManyArgs): Promise<any>
  findUnique({ args, query }: FindManyArgs): Promise<any>
  findUniqueOrThrow({ args, query }: FindManyArgs): Promise<any>
  findFirst({ args, query }: FindManyArgs): Promise<any>
}

const createExtendedQueryFunction: ExtendedQueryFunction = {
  findMany: async ({ args, query }: FindManyArgs) => {
    updateArgs(args)
    args.orderBy = args.orderBy || { updatedAt: 'desc' }

    return query(args)
  },
  findUnique: async ({ args, query }: FindManyArgs) => {
    updateArgs(args)

    return query(args)
  },
  findUniqueOrThrow: async ({ args, query }: FindManyArgs) => {
    updateArgs(args)

    return query(args)
  },
  findFirst: async ({ args, query }: FindManyArgs) => {
    updateArgs(args)

    return query(args)
  }
}

function updateArgs(args: FindManyArgs['args']) {
  args.where = { ...args.where, deletedBy: null }
}

export const extendedQueries = {
  taskSendEmail: createExtendedQueryFunction
}
