import { beforeEach, describe, expect, it, vi } from "vitest";

const embedTextsMock = vi.fn();
const runEmbeddingSpikeMock = vi.fn();

vi.mock("../../src/extension/offscreen/embeddingRuntime.js", () => ({
  embedTexts: (...args: unknown[]) => embedTextsMock(...args),
}));
vi.mock("../../src/extension/background/embeddingSpike.js", () => ({
  runEmbeddingSpike: (...args: unknown[]) => runEmbeddingSpikeMock(...args),
}));

function fakePort(name: string) {
  const messageListeners: Array<(message: unknown) => void> = [];
  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: { addListener: (fn: (message: unknown) => void) => messageListeners.push(fn) },
    emit(message: unknown) {
      messageListeners.forEach((fn) => fn(message));
    },
  };
}

describe("offscreen message routing", () => {
  let onConnectListener: ((port: ReturnType<typeof fakePort>) => void) | undefined;

  beforeEach(async () => {
    vi.resetModules();
    embedTextsMock.mockReset();
    runEmbeddingSpikeMock.mockReset();
    onConnectListener = undefined;

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        onConnect: {
          addListener: (fn: (port: ReturnType<typeof fakePort>) => void) => (onConnectListener = fn),
        },
      },
    };

    await import("../../src/extension/offscreen/offscreen.js");
  });

  it("responds to EMBED_TEXTS requests on the offscreen-embedding port", async () => {
    embedTextsMock.mockResolvedValueOnce([Float32Array.from([1, 0])]);
    const port = fakePort("offscreen-embedding");
    onConnectListener!(port);

    port.emit({ type: "EMBED_TEXTS", texts: ["hello"] });
    await Promise.resolve();
    await Promise.resolve();

    expect(embedTextsMock).toHaveBeenCalledWith(["hello"]);
    expect(port.postMessage).toHaveBeenCalledWith({ ok: true, embeddings: [[1, 0]] });
    expect(port.disconnect).toHaveBeenCalled();
  });

  it("responds with ok:false when embedding fails", async () => {
    embedTextsMock.mockRejectedValueOnce(new Error("pipeline init failed"));
    const port = fakePort("offscreen-embedding");
    onConnectListener!(port);

    port.emit({ type: "EMBED_TEXTS", texts: ["hello"] });
    await Promise.resolve();
    await Promise.resolve();

    expect(port.postMessage).toHaveBeenCalledWith({ ok: false, error: "pipeline init failed" });
  });

  it("still runs the spike report on the legacy offscreen-embedding-spike port", async () => {
    runEmbeddingSpikeMock.mockResolvedValueOnce({ overall: "VIABLE", steps: [] });
    const port = fakePort("offscreen-embedding-spike");
    onConnectListener!(port);
    await Promise.resolve();
    await Promise.resolve();

    expect(port.postMessage).toHaveBeenCalledWith({ overall: "VIABLE", steps: [] });
    expect(port.disconnect).toHaveBeenCalled();
  });

  it("ignores connections on unrelated port names", () => {
    const port = fakePort("something-else");
    expect(() => onConnectListener!(port)).not.toThrow();
    expect(embedTextsMock).not.toHaveBeenCalled();
    expect(runEmbeddingSpikeMock).not.toHaveBeenCalled();
  });
});
