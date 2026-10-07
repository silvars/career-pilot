import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { OffscreenEmbeddingProvider } from "../../src/extension/embeddings/offscreenEmbeddingProvider.js";

describe("OffscreenEmbeddingProvider", () => {
  let connectMock: Mock;
  let postMessageMock: Mock;
  let messageListener: ((message: unknown) => void) | undefined;
  let disconnectListener: (() => void) | undefined;

  beforeEach(() => {
    messageListener = undefined;
    disconnectListener = undefined;
    postMessageMock = vi.fn();

    connectMock = vi.fn(() => ({
      onMessage: { addListener: (fn: (message: unknown) => void) => (messageListener = fn) },
      onDisconnect: { addListener: (fn: () => void) => (disconnectListener = fn) },
      postMessage: postMessageMock,
      disconnect: vi.fn(),
    }));

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getContexts: vi.fn(async () => []),
        connect: connectMock,
        ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
        lastError: undefined,
      },
      offscreen: {
        createDocument: vi.fn(async () => undefined),
        Reason: { WORKERS: "WORKERS" },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("ensures the offscreen document exists, then requests embeddings over a long-lived Port", async () => {
    const provider = new OffscreenEmbeddingProvider();
    const embedPromise = provider.embed(["a", "b"]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    messageListener!({ ok: true, embeddings: [[1, 0], [0, 1]] });
    const embeddings = await embedPromise;

    expect(connectMock).toHaveBeenCalledWith({ name: "offscreen-embedding" });
    expect(postMessageMock).toHaveBeenCalledWith({ type: "EMBED_TEXTS", texts: ["a", "b"] });
    expect(embeddings.map((v) => Array.from(v))).toEqual([[1, 0], [0, 1]]);
  });

  it("throws when the offscreen document reports a failure", async () => {
    const provider = new OffscreenEmbeddingProvider();
    const embedPromise = provider.embed(["a"]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    messageListener!({ ok: false, error: "model failed to load" });

    await expect(embedPromise).rejects.toThrow("model failed to load");
  });

  it("rejects if the port disconnects with a runtime error before responding", async () => {
    const chromeGlobal = (globalThis as unknown as { chrome: { runtime: { lastError?: { message: string } } } })
      .chrome;
    const provider = new OffscreenEmbeddingProvider();
    const embedPromise = provider.embed(["a"]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    chromeGlobal.runtime.lastError = { message: "receiving end does not exist" };
    disconnectListener!();

    await expect(embedPromise).rejects.toThrow("receiving end does not exist");
  });
});
