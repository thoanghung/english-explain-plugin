import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"

import {
  STORAGE_KEYS,
  type ChatMessage,
  type ExplainRequest
} from "~/lib/constants"
import { chatWithContext } from "~/lib/openai"
import { getPageConversation, savePageConversation } from "~/lib/storage"

import "./sidepanel.css"

type ChatState = {
  pageUrl: string | null
  messages: ChatMessage[]
  inputValue: string
  loading: boolean
  error: string | null
}

const emptyState: ChatState = {
  pageUrl: null,
  messages: [],
  inputValue: "",
  loading: false,
  error: null
}

function SidePanel() {
  const [state, setState] = useState<ChatState>(emptyState)
  const [currentPageUrl, setCurrentPageUrl] = useState<string | null>(null)

  const normalizeConversationUrl = useCallback((rawUrl: string) => {
    try {
      const url = new URL(rawUrl)
      url.search = ""
      return url.toString()
    } catch {
      return null
    }
  }, [])

  const getCurrentTabUrl = useCallback(async (): Promise<string | null> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTabUrl = tabs[0]?.url

    if (!activeTabUrl) {
      return null
    }

    return normalizeConversationUrl(activeTabUrl)
  }, [normalizeConversationUrl])

  const openPageConversation = useCallback(
    async (pageUrl: string, prefillText?: string) => {
      const messages = await getPageConversation(pageUrl)
      setState((current) => ({
        ...current,
        pageUrl,
        messages,
        inputValue: prefillText
          ? current.pageUrl === pageUrl && current.inputValue.trim()
            ? `${current.inputValue}\n${prefillText}`
            : prefillText
          : current.pageUrl === pageUrl
            ? current.inputValue
            : "",
        error: null
      }))
    },
    []
  )

  const loadPageConversation = useCallback(
    async (request: ExplainRequest) => {
      setCurrentPageUrl(request.pageUrl)
      await openPageConversation(request.pageUrl)
    },
    [openPageConversation]
  )

  const sendPageMessage = useCallback(
    async (pageUrl: string, content: string, history: ChatMessage[]) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: Date.now()
      }

      const messagesWithUser = [...history, userMessage]

      setState((current) => ({
        ...current,
        pageUrl,
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
        await savePageConversation(pageUrl, messagesWithAssistant)

        setState((current) => ({
          ...current,
          pageUrl,
          messages: messagesWithAssistant,
          loading: false,
          error: null
        }))
      } catch (error) {
        setState((current) => ({
          ...current,
          pageUrl,
          loading: false,
          error: error instanceof Error ? error.message : "Something went wrong"
        }))
      }
    },
    []
  )

  const sendMessage = useCallback(async () => {
    if (!state.pageUrl || !state.inputValue.trim() || state.loading) {
      return
    }

    await sendPageMessage(state.pageUrl, state.inputValue, state.messages)
  }, [
    sendPageMessage,
    state.pageUrl,
    state.inputValue,
    state.loading,
    state.messages
  ])

  const syncConversationFromActiveTab = useCallback(async () => {
    const pageUrl = await getCurrentTabUrl()
    setCurrentPageUrl(pageUrl)

    if (!pageUrl) {
      setState((current) =>
        current.pageUrl
          ? {
              ...current,
              pageUrl: null,
              messages: [],
              inputValue: ""
            }
          : current
      )
      return
    }

    await openPageConversation(pageUrl)
  }, [getCurrentTabUrl, openPageConversation])

  useEffect(() => {
    const loadRequest = async () => {
      const result = await chrome.storage.session.get(
        STORAGE_KEYS.EXPLAIN_REQUEST
      )
      const request = result[STORAGE_KEYS.EXPLAIN_REQUEST] as
        | ExplainRequest
        | undefined

      if (request?.text && request.pageUrl) {
        await loadPageConversation(request)
        const history = await getPageConversation(request.pageUrl)
        await sendPageMessage(request.pageUrl, request.text, history)
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
          await loadPageConversation(request)
          const history = await getPageConversation(request.pageUrl)
          await sendPageMessage(request.pageUrl, request.text, history)
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
  }, [loadPageConversation, sendPageMessage, syncConversationFromActiveTab])

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
    const pageUrl = currentPageUrl ?? (await getCurrentTabUrl())

    if (!pageUrl) {
      setState((current) => ({
        ...current,
        error:
          "Could not detect the current page URL. Open a webpage and try again."
      }))
      return
    }

    setCurrentPageUrl(pageUrl)
    await openPageConversation(pageUrl)
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>AI Pocket</h1>
        <p>
          {state.pageUrl
            ? `Conversation: ${state.pageUrl}`
            : "Open a webpage and start chat for its URL"}
        </p>
      </header>

      {!state.pageUrl && (
        <section className="panel-empty">
          <p>
            {currentPageUrl
              ? `Current URL: ${currentPageUrl}`
              : "No active page detected in this window."}
          </p>
          <strong>Start chat now or right-click selected text.</strong>
          <button type="button" onClick={() => void handleStartChat()}>
            Start Chat For Current URL
          </button>
        </section>
      )}

      {state.pageUrl && sortedMessages.length === 0 && !state.loading && (
        <section className="panel-empty panel-empty-chat">
          <p>This page has no messages yet.</p>
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
          disabled={!state.pageUrl || state.loading}
        />
        <button
          type="submit"
          disabled={
            !state.pageUrl || state.loading || !state.inputValue.trim()
          }>
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
