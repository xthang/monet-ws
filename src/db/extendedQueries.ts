import { Prisma } from '@prisma/client'
import type {
  DefaultArgs,
  DynamicQueryExtensionArgs,
  DynamicQueryExtensionCb,
  InternalArgs
} from '@prisma/client/runtime/library'

type Model =
  | 'Notification'
  | 'Job'
  | 'TextTemplate'
  | 'CurrencyInfo'
  | 'CurrencyExchangeRate'
  | 'Account'
  | 'Organization'
  | 'OrganizationMembership'
  | 'Group'
  | 'GroupMembership'
  | 'GroupMembershipRequest'
  | 'GroupTab'
  | 'Message'
  | 'MoneyRecord'
  | 'MoneyRecordPartaker'
  | 'ExpenseDocument'
  | 'GroupTabSuggestedSettlement'
  | 'Order'
  | 'PaymentTransaction'
type model =
  | 'notification'
  | 'job'
  | 'textTemplate'
  | 'currencyInfo'
  | 'currencyExchangeRate'
  | 'account'
  | 'organization'
  | 'organizationMembership'
  | 'group'
  | 'groupMembership'
  | 'groupMembershipRequest'
  | 'groupTab'
  | 'message'
  | 'moneyRecord'
  | 'moneyRecordPartaker'
  | 'expenseDocument'
  | 'groupTabSuggestedSettlement'
  | 'order'
  | 'paymentTransaction'

type ExtendedQueryFunction<T extends Model> = {
  findMany: DynamicQueryExtensionCb<Prisma.TypeMap<InternalArgs & DefaultArgs>, 'model', T, 'findMany'>
  findUnique: DynamicQueryExtensionCb<Prisma.TypeMap<InternalArgs & DefaultArgs>, 'model', T, 'findUnique'>
  findUniqueOrThrow: DynamicQueryExtensionCb<
    Prisma.TypeMap<InternalArgs & DefaultArgs>,
    'model',
    T,
    'findUniqueOrThrow'
  >
  findFirst: DynamicQueryExtensionCb<Prisma.TypeMap<InternalArgs & DefaultArgs>, 'model', T, 'findFirst'>
}

const extendedQueryFunction: ExtendedQueryFunction<Model> = {
  findMany: async ({ args, query }) => {
    updateArgs(args)
    args.orderBy = args.orderBy || { updatedAt: 'desc' }

    return query(args)
  },
  findUnique: async ({ args, query }) => {
    updateArgs(args)

    return query(args)
  },
  findUniqueOrThrow: async ({ args, query }) => {
    updateArgs(args)

    return query(args)
  },
  findFirst: async ({ args, query }) => {
    updateArgs(args)

    return query(args)
  }
}

function updateArgs(args: { where?: any }) {
  args.where = { deletedBy: null, deletedAt: null, ...args.where }
}

const extendedQueryFunction2: ExtendedQueryFunction<Model> = {
  findMany: async ({ args, query }) => {
    updateArgs2(args)
    args.orderBy = args.orderBy || { updatedAt: 'desc' }

    return query(args)
  },
  findUnique: async ({ args, query }) => {
    updateArgs2(args)

    return query(args)
  },
  findUniqueOrThrow: async ({ args, query }) => {
    updateArgs2(args)

    return query(args)
  },
  findFirst: async ({ args, query }) => {
    updateArgs2(args)

    return query(args)
  }
}

function updateArgs2(args: { where?: any }) {
  args.where = { deletedBy: null, deletedAt: null, isActive: true, ...args.where }
}

export const extendedQueries: DynamicQueryExtensionArgs<
  { [n in model]: unknown },
  Prisma.TypeMap<InternalArgs & DefaultArgs>
> = {
  notification: extendedQueryFunction as ExtendedQueryFunction<'Notification'>,
  job: extendedQueryFunction as ExtendedQueryFunction<'Job'>,
  textTemplate: extendedQueryFunction as ExtendedQueryFunction<'TextTemplate'>,

  currencyInfo: extendedQueryFunction as ExtendedQueryFunction<'CurrencyInfo'>,
  currencyExchangeRate: extendedQueryFunction2 as ExtendedQueryFunction<'CurrencyExchangeRate'>,

  account: extendedQueryFunction2 as ExtendedQueryFunction<'Account'>,
  organization: extendedQueryFunction as ExtendedQueryFunction<'Organization'>,
  organizationMembership: extendedQueryFunction2 as ExtendedQueryFunction<'OrganizationMembership'>,
  group: extendedQueryFunction as ExtendedQueryFunction<'Group'>,
  groupMembership: extendedQueryFunction2 as ExtendedQueryFunction<'GroupMembership'>,
  groupMembershipRequest: extendedQueryFunction2 as ExtendedQueryFunction<'GroupMembershipRequest'>,
  groupTab: extendedQueryFunction as ExtendedQueryFunction<'GroupTab'>,
  message: extendedQueryFunction as ExtendedQueryFunction<'Message'>,
  moneyRecord: extendedQueryFunction as ExtendedQueryFunction<'MoneyRecord'>,
  moneyRecordPartaker: extendedQueryFunction2 as ExtendedQueryFunction<'MoneyRecordPartaker'>,
  expenseDocument: extendedQueryFunction as ExtendedQueryFunction<'ExpenseDocument'>,
  groupTabSuggestedSettlement: extendedQueryFunction2 as ExtendedQueryFunction<'GroupTabSuggestedSettlement'>,
  order: extendedQueryFunction as ExtendedQueryFunction<'Order'>,
  paymentTransaction: extendedQueryFunction as ExtendedQueryFunction<'PaymentTransaction'>
}
