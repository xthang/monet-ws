import type { Message } from '@/server/trpc/routers/message.d'
import type { Notification } from '@/types/notification'

export type WsNotification = Notification

export type WsChatMessage = Message

type WsResponseData =
  | {
      event: 'notification'
      data: WsNotification
    }
  | {
      event: 'chat-message-receipt'
      orgId: string | undefined
      data: { conversation_id: string; tab_id: string; ui_id: string; message_id: string; sent_to: string[] }
    }
  | {
      event: 'new-chat-message'
      orgId: string | undefined
      data: WsChatMessage
    }

export type WsResponsePayload = {} & WsResponseData
