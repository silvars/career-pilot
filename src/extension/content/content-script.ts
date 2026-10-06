import type { ExtensionMessage, ExtensionResponse, PageContext } from "../messaging/messages.js";

/**
 * FASE 3 shell only (SDD section 9): confirms the script is loaded and
 * reports basic page metadata. No job-description extraction, no form
 * access — that belongs to FASE 4+.
 */
function getPageContext(): PageContext {
  return { url: window.location.href, title: document.title };
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    switch (message?.type) {
      case "PING_CONTENT_SCRIPT":
        sendResponse({ success: true, data: { alive: true } });
        return false;
      case "GET_PAGE_CONTEXT":
        sendResponse({ success: true, data: getPageContext() });
        return false;
      default:
        // Not a message this content script handles — ignore (fail safely).
        return false;
    }
  }
);
