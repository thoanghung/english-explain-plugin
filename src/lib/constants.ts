export const CONTEXT_MENU_ID = "explain-with-ai"

export const STORAGE_KEYS = {
  API_KEY: "openai-api-key",
  EXPLAIN_REQUEST: "explainRequest",
  CONVERSATIONS: "conversations"
} as const

export type MessageRole = "user" | "assistant"

export interface ChatMessage {
  role: MessageRole
  content: string
  timestamp: number
}

export interface DomainConversation {
  domain: string
  messages: ChatMessage[]
  lastActive: number
}

export type ConversationsMap = Record<string, DomainConversation>

export type ExplainRequest = {
  text: string
  requestId: string
  domain: string
}
