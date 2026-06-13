export const CONTEXT_MENU_ID = "explain-with-ai"

export const STORAGE_KEYS = {
  API_KEY: "openai-api-key",
  EXPLAIN_REQUEST: "explainRequest"
} as const

export type ExplainRequest = {
  text: string
  requestId: string
}
