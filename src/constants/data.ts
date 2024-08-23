import { $Enums } from '@prisma/client'

export const PERSONAL_ACCOUNT_ORG_ID = '_'

export enum TextTemplateKey {
  NEW_CONVO_EMAIL_TITLE = 'NEW_CONVO_EMAIL_TITLE',
  NEW_CONVO_EMAIL_CONTENT = 'NEW_CONVO_EMAIL_CONTENT',
  NEW_CONVO_SMS_CONTENT = 'NEW_CONVO_SMS_CONTENT',
  DELETED_CONVO_EMAIL_TITLE = 'DELETED_CONVO_EMAIL_TITLE',
  DELETED_CONVO_EMAIL_CONTENT = 'DELETED_CONVO_EMAIL_CONTENT',
  DELETED_CONVO_SMS_CONTENT = 'DELETED_CONVO_SMS_CONTENT',
  CONVO_ADDED_MEMBER_EMAIL_TITLE = 'CONVO_ADDED_MEMBER_EMAIL_TITLE',
  CONVO_ADDED_MEMBER_EMAIL_CONTENT = 'CONVO_ADDED_MEMBER_EMAIL_CONTENT',
  CONVO_ADDED_MEMBER_SMS_CONTENT = 'CONVO_ADDED_MEMBER_SMS_CONTENT',
  CONVO_REMOVED_MEMBER_EMAIL_TITLE = 'CONVO_REMOVED_MEMBER_EMAIL_TITLE',
  CONVO_REMOVED_MEMBER_EMAIL_CONTENT = 'CONVO_REMOVED_MEMBER_EMAIL_CONTENT',
  CONVO_REMOVED_MEMBER_SMS_CONTENT = 'CONVO_REMOVED_MEMBER_SMS_CONTENT',

  PAYOR_EMAIL_TITLE = 'PAYOR_EMAIL_TITLE',
  PAYOR_EMAIL_CONTENT = 'PAYOR_EMAIL_CONTENT',
  PAYOR_SMS_CONTENT = 'PAYOR_SMS_CONTENT',

  SETTLED_ITEM_EMAIL_TITLE = 'SETTLED_ITEM_EMAIL_TITLE',
  SETTLED_ITEM_EMAIL_CONTENT = 'SETTLED_ITEM_EMAIL_CONTENT',
  SETTLED_ITEM_SMS_CONTENT = 'SETTLED_ITEM_SMS_CONTENT'
}

export enum ActivityLogType {
  group_create = 'group_create',
  group_update = 'group_update',
  group_upsertMembers = 'group_upsertMembers',
  groupTab_create = 'groupTab_create',
  groupTab_update = 'groupTab_update',
  groupTab_delete = 'groupTab_delete',
  message_create = 'message_create',
  message_update = 'message_update',
  message_delete = 'message_delete',
  moneyRecord_upsert = 'moneyRecord_upsert',
  moneyRecord_create = 'moneyRecord_create',
  moneyRecord_update = 'moneyRecord_update',
  moneyRecord_delete = 'moneyRecord_delete',
  groupTabSettlement_settle = 'groupTabSettlement_settle'
}

export const DEFAULT_GROUP_VISIBILITY = $Enums.GroupVisibility.secret
