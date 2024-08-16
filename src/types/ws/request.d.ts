export type Auth = {
  accountId: string
  authAccountId: string
  orgId?: string
}

export type WsRequestFullPayload = { requestId: string; token: string; locale: $Enums.Locale } & WsRequestPayload

export type WsRequestPayload = {
  event: 'send-msg'
  data: WsSendMessageRequestData
}

export type WsSendMessageRequestData = {
  uiId: string
  conversationId: string
  tabId: string
  text: string
  sentAt: Date
}
