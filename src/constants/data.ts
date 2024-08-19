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
  conversation_create = 'conversation_create',
  conversation_update = 'conversation_update',
  conversation_upsertMembers = 'conversation_upsertMembers',
  conversationTab_create = 'conversationTab_create',
  conversationTab_update = 'conversationTab_update',
  conversationTab_delete = 'conversationTab_delete',
  message_create = 'message_create',
  message_update = 'message_update',
  message_delete = 'message_delete',
  moneyRecord_upsert = 'moneyRecord_upsert',
  moneyRecord_create = 'moneyRecord_create',
  moneyRecord_update = 'moneyRecord_update',
  moneyRecord_delete = 'moneyRecord_delete',
  conversationTabSettlement_settle = 'conversationTabSettlement_settle'
}
