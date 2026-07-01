import {
  STORAGE_KEYS,
  type ChatMessage,
  type ConversationsMap
} from "~/lib/constants"

const MESSAGE_TTL_DAYS = 30
const MESSAGE_TTL_MS = MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000

function pruneExpiredMessages(messages: ChatMessage[]): ChatMessage[] {
  const now = Date.now()
  return messages.filter((message) => now - message.timestamp <= MESSAGE_TTL_MS)
}

async function getConversationsMap(): Promise<ConversationsMap> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS)
  const value = result[STORAGE_KEYS.CONVERSATIONS]

  if (!value || typeof value !== "object") {
    return {}
  }

  return value as ConversationsMap
}

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY)
  const apiKey = result[STORAGE_KEYS.API_KEY]
  return typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : null
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: apiKey.trim() })
}

export async function getPageConversation(
  pageUrl: string
): Promise<ChatMessage[]> {
  const conversations = await getConversationsMap()
  const conversation = conversations[pageUrl]

  if (!conversation) {
    return []
  }

  const prunedMessages = pruneExpiredMessages(conversation.messages)

  if (prunedMessages.length !== conversation.messages.length) {
    conversations[pageUrl] = {
      ...conversation,
      messages: prunedMessages,
      lastActive: Date.now()
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONVERSATIONS]: conversations
    })
  }

  return prunedMessages
}

export async function savePageConversation(
  pageUrl: string,
  messages: ChatMessage[]
): Promise<void> {
  const conversations = await getConversationsMap()
  conversations[pageUrl] = {
    pageUrl,
    messages: pruneExpiredMessages(messages),
    lastActive: Date.now()
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.CONVERSATIONS]: conversations
  })
}

export async function clearConversationHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CONVERSATIONS)
}
