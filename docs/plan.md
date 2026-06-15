# Plan: Per-Domain Chat Conversations

## Summary

Replace the current stateless explain flow with a persistent chat experience.
Each subdomain gets its own conversation stored in `chrome.storage.local`.
Right-click selected text should pre-fill the chat input, and users can send follow-up messages manually.

## Decisions

- Conversation scope: subdomain (`docs.example.com` is separate from `app.example.com`)
- Retention: persistent across browser restarts
- Cost control: limit context and history size per conversation
- Input mode: full chat input in side panel + right-click prefill

## Data Model

Store all conversations under one key in local storage.

```ts
// chrome.storage.local key: "conversations"

type MessageRole = "user" | "assistant"

interface ChatMessage {
  role: MessageRole
  content: string
  timestamp: number
}

interface DomainConversation {
  domain: string
  messages: ChatMessage[]
  lastActive: number
}

type ConversationsMap = Record<string, DomainConversation>
```

## Storage Rules

- Use `chrome.storage.local` for conversation history
- Keep max `50` messages per domain (drop oldest when exceeded)
- Remove messages older than `30` days during read/write pruning
- Send only the most recent `N` messages (start with `20`) to OpenAI for each request

## Implementation Steps

### 1) Constants and Types

Update `src/lib/constants.ts`:

- Add `STORAGE_KEYS.CONVERSATIONS`
- Extend `ExplainRequest` with `domain: string`
- Add `ChatMessage` and `DomainConversation` types

### 2) Storage Helpers

Update `src/lib/storage.ts`:

- Add `getDomainConversation(domain)`
- Add `saveDomainConversation(domain, messages)`
- Add prune helper (TTL + max messages)

### 3) OpenAI API Layer

Update `src/lib/openai.ts`:

- Replace one-shot explain function with context-aware chat function
- Function signature: `chatWithContext(userMessage, history)`
- Build payload as: system prompt + recent history + new user message

### 4) Background Domain Injection

Update `src/background/index.ts`:

- Parse hostname from `tab.url` using `new URL(tab.url).hostname`
- Store `domain` in `STORAGE_KEYS.EXPLAIN_REQUEST`

### 5) Side Panel Chat UI

Update `src/sidepanel.tsx`:

- Replace current state with chat state:
  - `domain`, `messages`, `inputValue`, `loading`, `error`
- On mount/request change:
  - read `ExplainRequest` from session storage
  - load domain history from local storage
  - prefill input from selected text
- On send:
  - append user message
  - call OpenAI with recent context
  - append assistant reply
  - persist updated conversation
- Render chat transcript with user/assistant bubbles and message timestamps

### 6) Styling

Update `src/sidepanel.css`:

- Add scrollable message list area
- Add distinct styles for user and assistant bubbles
- Add sticky bottom input form for chat

### 7) Privacy / Controls

Update `src/options.tsx`:

- Add "Clear conversation history" action
- Remove `STORAGE_KEYS.CONVERSATIONS` from local storage

## Verification Checklist

1. Right-click selected text opens side panel and pre-fills input
2. Sending message shows user bubble, loading state, and assistant response
3. Reopening side panel on same subdomain restores conversation
4. Different subdomain starts a separate conversation
5. History is capped at 50 messages per domain
6. Old messages beyond 30 days are pruned
7. Clear history action removes all stored conversations
8. Type check passes (`tsc --noEmit`)

## Risks and Mitigations

- Storage growth: capped messages + TTL pruning
- Token/cost growth: send only recent `N` messages
- Domain ambiguity: use exact hostname to keep contexts isolated
- Privacy concerns: provide clear-history control in options
