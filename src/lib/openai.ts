import type { ChatMessage } from "~/lib/constants"
import { getApiKey } from "~/lib/storage"

const EXPLAIN_SYSTEM_PROMPT =
  "You are a helpful English tutor. Explain selected text clearly in simple English. Cover meaning, context, and any difficult words or phrases."

const MAX_CONTEXT_MESSAGES = 20

function toOpenAiMessages(history: ChatMessage[], userMessage: string) {
  const recentHistory = history
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content }))

  return [
    { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
    ...recentHistory,
    { role: "user", content: userMessage }
  ]
}

export async function chatWithContext(
  userMessage: string,
  history: ChatMessage[]
): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not set. Open extension options to add your key."
    )
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: toOpenAiMessages(history, userMessage),
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${body}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("No explanation returned from OpenAI")
  }

  return content.trim()
}
