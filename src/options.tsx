import { useEffect, useState } from "react"

import { clearConversationHistory, getApiKey, setApiKey } from "~/lib/storage"

function OptionsPage() {
  const [apiKey, setApiKeyValue] = useState("")
  const [saved, setSaved] = useState(false)
  const [historyCleared, setHistoryCleared] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getApiKey().then((key) => {
      if (key) {
        setApiKeyValue(key)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    await setApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearHistory = async () => {
    await clearConversationHistory()
    setHistoryCleared(true)
    setTimeout(() => setHistoryCleared(false), 2000)
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading...</main>
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>AI Pocket Settings</h1>
      <p style={{ color: "#64748b" }}>
        Add your OpenAI API key to enable text explanations.
      </p>

      <form onSubmit={handleSave}>
        <label
          htmlFor="api-key"
          style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          OpenAI API key
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKeyValue(event.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            boxSizing: "border-box"
          }}
        />

        <button
          type="submit"
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#6366f1",
            color: "white",
            cursor: "pointer"
          }}>
          Save
        </button>

        {saved && (
          <p style={{ marginTop: 12, color: "#059669" }}>Settings saved.</p>
        )}
      </form>

      <section
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid #e2e8f0"
        }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Conversation history</h2>
        <p style={{ color: "#64748b", marginTop: 8 }}>
          Clear all saved domain conversations from local extension storage.
        </p>
        <button
          type="button"
          onClick={handleClearHistory}
          style={{
            marginTop: 8,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#b91c1c",
            color: "white",
            cursor: "pointer"
          }}>
          Clear conversation history
        </button>

        {historyCleared && (
          <p style={{ marginTop: 12, color: "#059669" }}>
            Conversation history cleared.
          </p>
        )}
      </section>
    </main>
  )
}

export default OptionsPage
