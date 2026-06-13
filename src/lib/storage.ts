import { STORAGE_KEYS } from "~/lib/constants"

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY)
  const apiKey = result[STORAGE_KEYS.API_KEY]
  return typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : null
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: apiKey.trim() })
}
