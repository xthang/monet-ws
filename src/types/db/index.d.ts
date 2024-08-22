import type {
  Account as DbAccount,
  AccountAlias as DbAccountAlias,
  AccountPlaceholder as DbAccountPlaceholder,
  MoneyRecord as DbMoneyRecord,
  MoneyRecordPartaker as DbMoneyRecordPartaker
} from '@prisma/client'

import type { Locale } from '@/constants/locales.ts'

import type { PhoneNumber } from '../phone-number'

type Account = Pick<
  DbAccount,
  | 'id'
  | 'authAccountId'
  | 'username'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'nameOrder'
  | 'fullName'
  | 'nickname'
  | 'imageUrl'
  | 'role'
> & { locale: Locale }
type AccountBasicInfo = Pick<
  DbAccount,
  | 'id'
  | 'authAccountId'
  | 'username'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'nameOrder'
  | 'fullName'
  | 'nickname'
  | 'imageUrl'
  | 'role'
>
type AccountAlias = Pick<DbAccountAlias, 'id' | 'accountId' | 'rawValue' | 'verificationStatus'> & {
  account?: AccountBasicInfo | null
  account_?: { username: string | null | undefined }
} & ({ type: 'email-addr'; value: string } | { type: 'phone-no'; value: PhoneNumber })
type AccountPlaceholder = Pick<DbAccountPlaceholder, 'id' | 'name'>

type MoneyRecord = DbMoneyRecord & { partakers: { [memberId: string]: MoneyRecordPartaker } }

type MoneyRecordPartaker = Omit<DbMoneyRecordPartaker, 'proportion'> & { proportion: number | null }
