const OFFSCREEN_DOCUMENT_URL = "offscreen.html";

/**
 * Ensures exactly one Offscreen Document exists (Chrome rejects a second
 * `createDocument` call while one is already open) — shared by every
 * caller that needs the embedding runtime. Only the Offscreen Document
 * gives the runtime a real window/document context; the service worker
 * alone was proven NOT_VIABLE for this (FASE 4.1-A spike: "no available
 * backend found").
 */
export async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_URL,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification:
      "Run the Transformers.js/ONNX Runtime WASM embedding runtime for local semantic retrieval outside the service worker.",
  });
}
