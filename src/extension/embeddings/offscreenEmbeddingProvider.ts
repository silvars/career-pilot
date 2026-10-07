import type { EmbeddingProvider } from "../../profile/embeddingProvider.js";
import { ensureOffscreenDocument } from "../background/offscreenDocument.js";

const OFFSCREEN_EMBEDDING_PORT_NAME = "offscreen-embedding";

interface EmbedTextsRequest {
  type: "EMBED_TEXTS";
  texts: string[];
}

interface EmbedTextsResponse {
  ok: boolean;
  embeddings?: number[][];
  error?: string;
}

/**
 * Chrome-specific EmbeddingProvider (SDD "Local Semantic Retrieval" section
 * 8): offloads the actual embedding work to the Offscreen Document over a
 * long-lived `chrome.runtime.Port`. A plain `sendMessage`/`onMessage` round
 * trip was proven unreliable in the FASE 4.1-B spike — merely awaiting a
 * promise doesn't count as "active work" under MV3's service-worker
 * lifecycle, so the idle timer can tear the channel down mid-flight once
 * the embedding call takes more than a trivial amount of time. An open Port
 * is Chrome's documented fix.
 */
export class OffscreenEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<Float32Array[]> {
    await ensureOffscreenDocument();

    const response = await new Promise<EmbedTextsResponse>((resolve, reject) => {
      const port = chrome.runtime.connect({ name: OFFSCREEN_EMBEDDING_PORT_NAME });
      port.onMessage.addListener((message: EmbedTextsResponse) => {
        resolve(message);
        port.disconnect();
      });
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
      });
      const request: EmbedTextsRequest = { type: "EMBED_TEXTS", texts };
      port.postMessage(request);
    });

    if (!response.ok || !response.embeddings) {
      throw new Error(`Offscreen embedding failed: ${response.error ?? "unknown error"}`);
    }
    return response.embeddings.map((vector) => Float32Array.from(vector));
  }
}
