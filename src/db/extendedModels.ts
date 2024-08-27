import type {
  Prisma,
  PrismaPromise,
  Account,
  AccountAlias,
  Group,
  GroupMembership,
  GroupMembershipRequest,
  GroupTab,
  GroupTabSuggestedSettlement,
  CurrencyInfo,
  CurrencyExchangeRate,
  Job,
  Message,
  MoneyRecord,
  MoneyRecordPartaker,
  Notification,
  Order,
  Organization,
  OrganizationMembership,
  PaymentTransaction,
  TextTemplate
} from '@prisma/client'
import type { GetBatchResult } from '@prisma/client/runtime/library'

import type { PrismaTransactionClient } from './types'

import db from './index'

type model =
  | 'notification'
  | 'job'
  | 'textTemplate'
  | 'currencyInfo'
  | 'currencyExchangeRate'
  | 'account'
  | 'accountAlias'
  | 'organization'
  | 'organizationMembership'
  | 'group'
  | 'groupMembership'
  | 'groupMembershipRequest'
  | 'groupTab'
  | 'message'
  | 'moneyRecord'
  | 'moneyRecordPartaker'
  | 'groupTabSuggestedSettlement'
  | 'order'
  | 'paymentTransaction'

type SoftDeleteProps<T, S> = {
  tx?: PrismaTransactionClient
  where: { id?: string } & Omit<T, 'id'>
  deletedBy: string
  select?: S
}

type SoftDeletesProps<T> = {
  tx?: PrismaTransactionClient
  where: { ids?: string[] } & T
  deletedBy: string
}

type ExtendedModel<X, T, K, S> = {
  softDelete(props: SoftDeleteProps<T, S>): PrismaPromise<X>
  softDeletes(props: SoftDeletesProps<K>): PrismaPromise<GetBatchResult> // returns updated count
}

const createSoftDeleteFunctions = <X, T, K, S>(modelName: model): ExtendedModel<X, T, K, S> => {
  function softDelete({ tx, where: { id, ...where }, deletedBy, select }: SoftDeleteProps<T, S>) {
    const updateData = {
      where: { id, ...where },
      data: { deletedAt: new Date(), deletedBy },
      select
    }

    return ((tx ?? db)[modelName].update as any)(updateData) as PrismaPromise<X>
  }

  function softDeletes({ tx, where: { ids, ...where }, deletedBy }: SoftDeletesProps<K>) {
    const updateData = {
      where: { id: ids && { in: ids }, ...where },
      data: { deletedAt: new Date(), deletedBy }
    }

    return ((tx ?? db)[modelName].updateMany as any)(updateData) as PrismaPromise<GetBatchResult>
  }

  return { softDelete, softDeletes }
}

const createSoftDeleteFunctions2 = <X, T, K, S>(modelName: model): ExtendedModel<X, T, K, S> => {
  function softDelete({ tx, where: { id, ...where }, deletedBy, select }: SoftDeleteProps<T, S>) {
    const updateData = {
      where: { id, ...where },
      data: { deletedAt: new Date(), deletedBy, isActive: null },
      select
    }

    return ((tx ?? db)[modelName].update as any)(updateData) as PrismaPromise<X>
  }

  function softDeletes({ tx, where: { ids, ...where }, deletedBy }: SoftDeletesProps<K>) {
    const updateData = {
      where: { id: ids && { in: ids }, ...where },
      data: { deletedAt: new Date(), deletedBy, isActive: null }
    }

    return ((tx ?? db)[modelName].updateMany as any)(updateData) as PrismaPromise<GetBatchResult>
  }

  return { softDelete, softDeletes }
}

export const extendedModels = {
  notification: createSoftDeleteFunctions<
    Notification,
    Prisma.NotificationWhereUniqueInput,
    Prisma.NotificationWhereInput,
    Prisma.NotificationSelect
  >('notification'),
  job: createSoftDeleteFunctions<Job, Prisma.JobWhereUniqueInput, Prisma.JobWhereInput, Prisma.JobSelect>('job'),
  textTemplate: createSoftDeleteFunctions<
    TextTemplate,
    Prisma.TextTemplateWhereUniqueInput,
    Prisma.TextTemplateWhereInput,
    Prisma.TextTemplateSelect
  >('textTemplate'),

  currencyInfo: createSoftDeleteFunctions<
    CurrencyInfo,
    Prisma.CurrencyInfoWhereUniqueInput,
    Prisma.CurrencyInfoWhereInput,
    Prisma.CurrencyInfoSelect
  >('currencyInfo'),
  currencyExchangeRate: createSoftDeleteFunctions2<
    CurrencyExchangeRate,
    Prisma.CurrencyExchangeRateWhereUniqueInput,
    Prisma.CurrencyExchangeRateWhereInput,
    Prisma.CurrencyExchangeRateSelect
  >('currencyExchangeRate'),

  account: createSoftDeleteFunctions2<
    Account,
    Prisma.AccountWhereUniqueInput,
    Prisma.AccountWhereInput,
    Prisma.AccountSelect
  >('account'),
  accountAlias: createSoftDeleteFunctions2<
    AccountAlias,
    Prisma.AccountAliasWhereUniqueInput,
    Prisma.AccountAliasWhereInput,
    Prisma.AccountAliasSelect
  >('accountAlias'),
  organization: createSoftDeleteFunctions<
    Organization,
    Prisma.OrganizationWhereUniqueInput,
    Prisma.OrganizationWhereInput,
    Prisma.OrganizationSelect
  >('organization'),
  organizationMembership: createSoftDeleteFunctions2<
    OrganizationMembership,
    Prisma.OrganizationMembershipWhereUniqueInput,
    Prisma.OrganizationMembershipWhereInput,
    Prisma.OrganizationMembershipSelect
  >('organizationMembership'),
  group: createSoftDeleteFunctions<Group, Prisma.GroupWhereUniqueInput, Prisma.GroupWhereInput, Prisma.GroupSelect>(
    'group'
  ),
  groupMembership: createSoftDeleteFunctions2<
    GroupMembership,
    Prisma.GroupMembershipWhereUniqueInput,
    Prisma.GroupMembershipWhereInput,
    Prisma.GroupMembershipSelect
  >('groupMembership'),
  groupMembershipRequest: createSoftDeleteFunctions2<
    GroupMembershipRequest,
    Prisma.GroupMembershipRequestWhereUniqueInput,
    Prisma.GroupMembershipRequestWhereInput,
    Prisma.GroupMembershipRequestSelect
  >('groupMembershipRequest'),
  groupTab: createSoftDeleteFunctions<
    GroupTab,
    Prisma.GroupTabWhereUniqueInput,
    Prisma.GroupTabWhereInput,
    Prisma.GroupTabSelect
  >('groupTab'),
  message: createSoftDeleteFunctions<
    Message,
    Prisma.MessageWhereUniqueInput,
    Prisma.MessageWhereInput,
    Prisma.MessageSelect
  >('message'),
  moneyRecord: createSoftDeleteFunctions<
    MoneyRecord,
    Prisma.MoneyRecordWhereUniqueInput,
    Prisma.MoneyRecordWhereInput,
    Prisma.MoneyRecordSelect
  >('moneyRecord'),
  moneyRecordPartaker: createSoftDeleteFunctions2<
    MoneyRecordPartaker,
    Prisma.MoneyRecordPartakerWhereUniqueInput,
    Prisma.MoneyRecordPartakerWhereInput,
    Prisma.MoneyRecordPartakerSelect
  >('moneyRecordPartaker'),
  groupTabSuggestedSettlement: createSoftDeleteFunctions2<
    GroupTabSuggestedSettlement,
    Prisma.GroupTabSuggestedSettlementWhereUniqueInput,
    Prisma.GroupTabSuggestedSettlementWhereInput,
    Prisma.GroupTabSuggestedSettlementSelect
  >('groupTabSuggestedSettlement'),
  order: createSoftDeleteFunctions<Order, Prisma.OrderWhereUniqueInput, Prisma.OrderWhereInput, Prisma.OrderSelect>(
    'order'
  ),
  paymentTransaction: createSoftDeleteFunctions<
    PaymentTransaction,
    Prisma.PaymentTransactionWhereUniqueInput,
    Prisma.PaymentTransactionWhereInput,
    Prisma.PaymentTransactionSelect
  >('paymentTransaction')
}
