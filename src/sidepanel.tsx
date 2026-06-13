import { useCallback, useEffect, useState } from "react"

import {
  type ExplainRequest,
  STORAGE_KEYS
} from "~/lib/constants"
import { explainText } from "~/lib/openai"

import "./sidepanel.css"

type PanelState = {
  request: ExplainRequest | null
  loading: boolean
  explanation: string | null
  error: string | null
}

const emptyState: PanelState = {
  request: null,
  loading: false,
  explanation: null,
  error: null
}

function SidePanel() {
  const [state, setState] = useState<PanelState>(emptyState)

  const runExplain = useCallback(async (request: ExplainRequest) => {
    setState({
      request,
      loading: true,
      explanation: null,
      error: null
    })

    try {
      const explanation = await explainText(request.text)
      setState({
        request,
        loading: false,
        explanation,
        error: null
      })
    } catch (error) {
      setState({
        request,
        loading: false,
        explanation: null,
        error:
          error instanceof Error ? error.message : "Something went wrong"
      })
    }
  }, [])

  useEffect(() => {
    const loadRequest = async () => {
      const result = await chrome.storage.session.get(
        STORAGE_KEYS.EXPLAIN_REQUEST
      )
      const request = result[STORAGE_KEYS.EXPLAIN_REQUEST] as
        | ExplainRequest
        | undefined

      if (request?.text) {
        runExplain(request)
      }
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
        runExplain(change.newValue as ExplainRequest)
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [runExplain])

  const openOptions = () => {
    void chrome.runtime.openOptionsPage()
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>AI Pocket</h1>
        <p>English explanations for selected text</p>
      </header>

      {!state.request && !state.loading && (
        <section className="panel-empty">
          <p>Select text on a page, right-click, then choose</p>
          <strong>Explain with AI</strong>
        </section>
      )}

      {state.request && (
        <section className="panel-section">
          <h2>Selected text</h2>
          <blockquote>{state.request.text}</blockquote>
        </section>
      )}

      {state.loading && (
        <section className="panel-section panel-loading">
          <div className="spinner" aria-hidden="true" />
          <p>Loading...</p>
        </section>
      )}

      {state.error && (
        <section className="panel-section panel-error">
          <h2>Could not explain</h2>
          <p>{state.error}</p>
          {state.error.includes("API key") && (
            <button type="button" onClick={openOptions}>
              Open settings
            </button>
          )}
        </section>
      )}

      {state.explanation && (
        <section className="panel-section">
          <h2>Explanation</h2>
          <div className="explanation">{state.explanation}</div>
        </section>
      )}
    </main>
  )
}

export default SidePanel
