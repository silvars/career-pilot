import { beforeEach, describe, expect, it, vi } from "vitest";

const extractorMock = vi.fn();
const pipelineMock = vi.fn(async () => extractorMock);

vi.mock("@huggingface/transformers", () => ({
  pipeline: (..._args: unknown[]) => pipelineMock(),
  // `chrome` is undefined in this Node test environment, so
  // configureLocalWasmRuntime() returns early and never touches this.
  env: { backends: { onnx: { wasm: {} } } },
}));

function tensor(values: number[]) {
  return { data: Float32Array.from(values) };
}

describe("embeddingRuntime", () => {
  beforeEach(() => {
    vi.resetModules();
    pipelineMock.mockClear();
    extractorMock.mockReset();
  });

  it("embeds each text and returns one Float32Array per input, in order", async () => {
    extractorMock
      .mockResolvedValueOnce(tensor([1, 0, 0]))
      .mockResolvedValueOnce(tensor([0, 1, 0]));

    const { embedTexts } = await import("../../src/extension/offscreen/embeddingRuntime.js");
    const [first, second] = await embedTexts(["query: a", "passage: b"]);

    expect(Array.from(first)).toEqual([1, 0, 0]);
    expect(Array.from(second)).toEqual([0, 1, 0]);
    expect(extractorMock).toHaveBeenNthCalledWith(1, "query: a", { pooling: "mean", normalize: true });
    expect(extractorMock).toHaveBeenNthCalledWith(2, "passage: b", { pooling: "mean", normalize: true });
  });

  it("loads the pipeline once and reuses it across multiple embedTexts calls", async () => {
    extractorMock.mockResolvedValue(tensor([1, 0]));

    const { embedTexts } = await import("../../src/extension/offscreen/embeddingRuntime.js");
    await embedTexts(["a"]);
    await embedTexts(["b"]);
    await embedTexts(["c"]);

    expect(pipelineMock).toHaveBeenCalledTimes(1);
  });

  it("propagates pipeline initialization failure", async () => {
    pipelineMock.mockRejectedValueOnce(new Error("model failed to load"));

    const { embedTexts } = await import("../../src/extension/offscreen/embeddingRuntime.js");

    await expect(embedTexts(["a"])).rejects.toThrow("model failed to load");
  });

  it("propagates an embedding failure for an individual text", async () => {
    extractorMock.mockRejectedValueOnce(new Error("tokenization failed"));

    const { embedTexts } = await import("../../src/extension/offscreen/embeddingRuntime.js");

    await expect(embedTexts(["a"])).rejects.toThrow("tokenization failed");
  });

  it("returns an empty array for an empty input", async () => {
    const { embedTexts } = await import("../../src/extension/offscreen/embeddingRuntime.js");
    await expect(embedTexts([])).resolves.toEqual([]);
  });
});
