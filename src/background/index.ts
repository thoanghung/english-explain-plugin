import { CONTEXT_MENU_ID, STORAGE_KEYS } from "~/lib/constants"

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

function registerContextMenu() {
  chrome.contextMenus.create(
    {
      id: CONTEXT_MENU_ID,
      title: "Explain with AI",
      contexts: ["selection"]
    },
    () => {
      if (chrome.runtime.lastError) {
        chrome.contextMenus.update(CONTEXT_MENU_ID, {
          title: "Explain with AI",
          contexts: ["selection"]
        })
      }
    }
  )
}

registerContextMenu()
chrome.runtime.onInstalled.addListener(registerContextMenu)

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    info.menuItemId !== CONTEXT_MENU_ID ||
    !info.selectionText?.trim() ||
    !tab?.windowId
  ) {
    return
  }

  await chrome.storage.session.set({
    [STORAGE_KEYS.EXPLAIN_REQUEST]: {
      text: info.selectionText.trim(),
      requestId: crypto.randomUUID()
    }
  })

  await chrome.sidePanel.open({ windowId: tab.windowId })
})
