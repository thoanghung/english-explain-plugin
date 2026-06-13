function IndexPopup() {
  const openOptions = () => {
    void chrome.runtime.openOptionsPage()
  }

  return (
    <div style={{ padding: 16, width: 260, fontFamily: "system-ui" }}>
      <h2 style={{ marginTop: 0, fontSize: "1rem" }}>AI Pocket</h2>
      <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
        Select text, right-click, then choose <strong>Explain with AI</strong>.
      </p>
      <button
        type="button"
        onClick={openOptions}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "none",
          background: "#6366f1",
          color: "white",
          cursor: "pointer"
        }}>
        Open settings
      </button>
    </div>
  )
}

export default IndexPopup
