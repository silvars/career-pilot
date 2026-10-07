import { runEmbeddingSpike } from "../background/embeddingSpike.js";
import { embedTexts } from "./embeddingRuntime.js";

/**
 * FASE 4.1-B SPIKE ONLY — runs inside the Offscreen Document (real
 * window/document context, unlike the service worker), to test whether
 * that's a viable host for the Transformers.js/ONNX Runtime WASM embedding
 * runtime after FASE 4.1-A found the service worker NOT_VIABLE ("no
 * available backend found. ERR: [wasm]"). Throwaway/diagnostic code — see
 * SDD/CAREER_PILOT_LOCAL_SEMANTIC_RETRIEVAL_SDD.md.
 *
 * Uses a long-lived `chrome.runtime.Port` (not one-shot `sendMessage`) —
 * real finding (2026-10-07): a plain request/response round trip
 * intermittently failed because the service worker's idle timer could fire
 * while it was merely awaiting this multi-second response, since awaiting a
 * promise alone doesn't count as "active work" under MV3. An open port does.
 */
const OFFSCREEN_SPIKE_PORT_NAME = "offscreen-embedding-spike";

/**
 * Real (non-spike) general-purpose embedding endpoint (SDD "Local Semantic
 * Retrieval" section 8), consumed by OffscreenEmbeddingProvider. Reuses the
 * same proven long-lived Port pattern as the spike above.
 */
const OFFSCREEN_EMBEDDING_PORT_NAME = "offscreen-embedding";

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === OFFSCREEN_SPIKE_PORT_NAME) {
    runEmbeddingSpike().then((report) => {
      port.postMessage(report);
      port.disconnect();
    });
    return;
  }

  if (port.name === OFFSCREEN_EMBEDDING_PORT_NAME) {
    port.onMessage.addListener((message: { type: string; texts?: string[] }) => {
      if (message?.type !== "EMBED_TEXTS") {
        return;
      }
      embedTexts(message.texts ?? [])
        .then((embeddings) => {
          port.postMessage({ ok: true, embeddings: embeddings.map((vector) => Array.from(vector)) });
          port.disconnect();
        })
        .catch((cause) => {
          const err = cause instanceof Error ? cause : new Error(String(cause));
          port.postMessage({ ok: false, error: err.message });
          port.disconnect();
        });
    });
  }
});


