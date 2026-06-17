import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"

import {
  STORAGE_KEYS,
  type ChatMessage,
  type ExplainRequest
} from "~/lib/constants"
import { chatWithContext } from "~/lib/openai"
import { getDomainConversation, saveDomainConversation } from "~/lib/storage"

import "./sidepanel.css"

type ChatState = {
  domain: string | null
  messages: ChatMessage[]
  inputValue: string
  loading: boolean
  error: string | null
}

const emptyState: ChatState = {
  domain: null,
  messages: [],
  inputValue: "",
  loading: false,
  error: null
}

function SidePanel() {
  const [state, setState] = useState<ChatState>(emptyState)
  const [currentDomain, setCurrentDomain] = useState<string | null>(null)

  const getCurrentTabDomain = useCallback(async (): Promise<string | null> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTabUrl = tabs[0]?.url

    if (!activeTabUrl) {
      return null
    }

    try {
      return new URL(activeTabUrl).hostname
    } catch {
      return null
    }
  }, [])

  const openDomainConversation = useCallback(
    async (domain: string, prefillText?: string) => {
      const messages = await getDomainConversation(domain)
      setState((current) => ({
        ...current,
        domain,
        messages,
        inputValue: prefillText
          ? current.domain === domain && current.inputValue.trim()
            ? `${current.inputValue}\n${prefillText}`
            : prefillText
          : current.domain === domain
            ? current.inputValue
            : "",
        error: null
      }))
    },
    []
  )

  const loadDomainConversation = useCallback(
    async (request: ExplainRequest) => {
      setCurrentDomain(request.domain)
      await openDomainConversation(request.domain)
    },
    [openDomainConversation]
  )

  const sendDomainMessage = useCallback(
    async (domain: string, content: string, history: ChatMessage[]) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: Date.now()
      }

      const messagesWithUser = [...history, userMessage]

      setState((current) => ({
        ...current,
        domain,
        messages: messagesWithUser,
        inputValue: "",
        loading: true,
        error: null
      }))

      try {
        const assistantContent = await chatWithContext(
          userMessage.content,
          history
        )
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: assistantContent,
          timestamp: Date.now()
        }

        const messagesWithAssistant = [...messagesWithUser, assistantMessage]
        await saveDomainConversation(domain, messagesWithAssistant)

        setState((current) => ({
          ...current,
          domain,
          messages: messagesWithAssistant,
          loading: false,
          error: null
        }))
      } catch (error) {
        setState((current) => ({
          ...current,
          domain,
          loading: false,
          error: error instanceof Error ? error.message : "Something went wrong"
        }))
      }
    },
    []
  )

  const sendMessage = useCallback(async () => {
    if (!state.domain || !state.inputValue.trim() || state.loading) {
      return
    }

    await sendDomainMessage(state.domain, state.inputValue, state.messages)
  }, [
    sendDomainMessage,
    state.domain,
    state.inputValue,
    state.loading,
    state.messages
  ])

  const syncConversationFromActiveTab = useCallback(async () => {
    const domain = await getCurrentTabDomain()
    setCurrentDomain(domain)

    if (!domain) {
      setState((current) =>
        current.domain
          ? {
              ...current,
              domain: null,
              messages: [],
              inputValue: ""
            }
          : current
      )
      return
    }

    await openDomainConversation(domain)
  }, [getCurrentTabDomain, openDomainConversation])

  useEffect(() => {
    const loadRequest = async () => {
      const result = await chrome.storage.session.get(
        STORAGE_KEYS.EXPLAIN_REQUEST
      )
      const request = result[STORAGE_KEYS.EXPLAIN_REQUEST] as
        | ExplainRequest
        | undefined

      if (request?.text && request.domain) {
        await loadDomainConversation(request)
        const history = await getDomainConversation(request.domain)
        await sendDomainMessage(request.domain, request.text, history)
        return
      }

      await syncConversationFromActiveTab()
    }

    void loadRequest()

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "session") {
        return
      }

      const change = changes[STORAGE_KEYS.EXPLAIN_REQUEST]
      if (change?.newValue) {
        const request = change.newValue as ExplainRequest
        void (async () => {
          await loadDomainConversation(request)
          const history = await getDomainConversation(request.domain)
          await sendDomainMessage(request.domain, request.text, history)
        })()
      }
    }

    const onTabActivated = () => {
      void syncConversationFromActiveTab()
    }

    const onTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (!tab.active) {
        return
      }

      if (
        changeInfo.status === "complete" ||
        typeof changeInfo.url === "string"
      ) {
        void syncConversationFromActiveTab()
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    chrome.tabs.onActivated.addListener(onTabActivated)
    chrome.tabs.onUpdated.addListener(onTabUpdated)

    return () => {
      chrome.storage.onChanged.removeListener(onChanged)
      chrome.tabs.onActivated.removeListener(onTabActivated)
      chrome.tabs.onUpdated.removeListener(onTabUpdated)
    }
  }, [loadDomainConversation, sendDomainMessage, syncConversationFromActiveTab])

  const sortedMessages = useMemo(
    () => [...state.messages].sort((a, b) => a.timestamp - b.timestamp),
    [state.messages]
  )

  const openOptions = () => {
    void chrome.runtime.openOptionsPage()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void sendMessage()
  }

  const handleStartChat = async () => {
    const domain = currentDomain ?? (await getCurrentTabDomain())

    if (!domain) {
      setState((current) => ({
        ...current,
        error:
          "Could not detect the current domain. Open a webpage and try again."
      }))
      return
    }

    setCurrentDomain(domain)
    await openDomainConversation(domain)
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>AI Pocket</h1>
        <p>
          {state.domain
            ? `Conversation: ${state.domain}`
            : "Open a webpage and start chat for its domain"}
        </p>
      </header>

      {!state.domain && (
        <section className="panel-empty">
          <p>
            {currentDomain
              ? `Current domain: ${currentDomain}`
              : "No active page detected in this window."}
          </p>
          <strong>Start chat now or right-click selected text.</strong>
          <button type="button" onClick={() => void handleStartChat()}>
            Start Chat For Current Domain
          </button>
        </section>
      )}

      {state.domain && sortedMessages.length === 0 && !state.loading && (
        <section className="panel-empty panel-empty-chat">
          <p>This domain has no messages yet.</p>
          <strong>
            Type a question below or use right-click text selection.
          </strong>
        </section>
      )}

      <section className="chat-messages" aria-live="polite">
        {sortedMessages.map((message, index) => (
          <article
            key={`${message.timestamp}-${index}`}
            className={`chat-message ${
              message.role === "user"
                ? "chat-message-user"
                : "chat-message-assistant"
            }`}>
            {message.role === "assistant" ? (
              <div className="chat-markdown">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="chat-message-plain">{message.content}</p>
            )}
            <time>
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </time>
          </article>
        ))}

        {state.loading && (
          <section className="panel-loading">
            <div className="spinner" aria-hidden="true" />
            <p>AI is thinking...</p>
          </section>
        )}
      </section>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          value={state.inputValue}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              inputValue: event.target.value
            }))
          }
          placeholder="Ask about selected text or type a follow-up"
          rows={3}
          disabled={!state.domain || state.loading}
        />
        <button
          type="submit"
          disabled={!state.domain || state.loading || !state.inputValue.trim()}>
          Send
        </button>
      </form>

      {state.error && (
        <section className="panel-error">
          <h2>Request failed</h2>
          <p>{state.error}</p>
          {state.error.includes("API key") && (
            <button type="button" onClick={openOptions}>
              Open settings
            </button>
          )}
        </section>
      )}
    </main>
  )
}

export default SidePanel
