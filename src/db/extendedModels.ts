import type {
  Prisma,
  PrismaPromise,
  Account,
  AccountAlias,
  Conversation,
  ConversationMembership,
  ConversationTab,
  ConversationTabSuggestedSettlement,
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
  | 'currencyExchangeRate'
  | 'account'
  | 'accountAlias'
  | 'organization'
  | 'organizationMembership'
  | 'conversation'
  | 'conversationMembership'
  | 'conversationTab'
  | 'message'
  | 'moneyRecord'
  | 'moneyRecordPartaker'
  | 'conversationTabSuggestedSettlement'
  | 'order'
  | 'paymentTransaction'

type SoftDeleteProps<T, S> = {
  tx?: PrismaTransactionClient
  where: { id?: string } & Omit<T, 'id'>
  deletedBy: string
  isActive?: null
  select?: S
}

type SoftDeletesProps<T> = {
  tx?: PrismaTransactionClient
  where: { ids?: string[] } & T
  deletedBy: string
  isActive?: null
}

type ExtendedModel<X, T, K, S> = {
  softDelete(props: SoftDeleteProps<T, S>): PrismaPromise<X>
  softDeletes(props: SoftDeletesProps<K>): PrismaPromise<GetBatchResult> // returns updated count
}

const createSoftDeleteFunctions = <X, T, K, S>(modelName: model): ExtendedModel<X, T, K, S> => {
  function softDelete({ tx, where: { id, ...where }, deletedBy, isActive, select }: SoftDeleteProps<T, S>) {
    const updateData = {
      where: { id, ...where },
      data: { deletedAt: new Date(), deletedBy, isActive },
      select
    }

    return ((tx ?? db)[modelName].update as any)(updateData) as PrismaPromise<X>
  }

  function softDeletes({ tx, where: { ids, ...where }, deletedBy, isActive }: SoftDeletesProps<K>) {
    const updateData = {
      where: { id: ids && { in: ids }, ...where },
      data: { deletedAt: new Date(), deletedBy, isActive }
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

  currencyExchangeRate: createSoftDeleteFunctions<
    CurrencyExchangeRate,
    Prisma.CurrencyExchangeRateWhereUniqueInput,
    Prisma.CurrencyExchangeRateWhereInput,
    Prisma.CurrencyExchangeRateSelect
  >('currencyExchangeRate'),

  account: createSoftDeleteFunctions<
    Account,
    Prisma.AccountWhereUniqueInput,
    Prisma.AccountWhereInput,
    Prisma.AccountSelect
  >('account'),
  accountAlias: createSoftDeleteFunctions<
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
  organizationMembership: createSoftDeleteFunctions<
    OrganizationMembership,
    Prisma.OrganizationMembershipWhereUniqueInput,
    Prisma.OrganizationMembershipWhereInput,
    Prisma.OrganizationMembershipSelect
  >('organizationMembership'),
  conversation: createSoftDeleteFunctions<
    Conversation,
    Prisma.ConversationWhereUniqueInput,
    Prisma.ConversationWhereInput,
    Prisma.ConversationSelect
  >('conversation'),
  conversationMembership: createSoftDeleteFunctions<
    ConversationMembership,
    Prisma.ConversationMembershipWhereUniqueInput,
    Prisma.ConversationMembershipWhereInput,
    Prisma.ConversationMembershipSelect
  >('conversationMembership'),
  conversationTab: createSoftDeleteFunctions<
    ConversationTab,
    Prisma.ConversationTabWhereUniqueInput,
    Prisma.ConversationTabWhereInput,
    Prisma.ConversationTabSelect
  >('conversationTab'),
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
  moneyRecordPartaker: createSoftDeleteFunctions<
    MoneyRecordPartaker,
    Prisma.MoneyRecordPartakerWhereUniqueInput,
    Prisma.MoneyRecordPartakerWhereInput,
    Prisma.MoneyRecordPartakerSelect
  >('moneyRecordPartaker'),
  conversationTabSuggestedSettlement: createSoftDeleteFunctions<
    ConversationTabSuggestedSettlement,
    Prisma.ConversationTabSuggestedSettlementWhereUniqueInput,
    Prisma.ConversationTabSuggestedSettlementWhereInput,
    Prisma.ConversationTabSuggestedSettlementSelect
  >('conversationTabSuggestedSettlement'),
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
