import { beforeEach, describe, expect, it, vi } from "vitest";

// FASE 4.1-A viability spike ONLY: these tests cover the spike's own report
// assembly/error-handling logic (dimension/finite checks, prefixes, cosine
// similarity), not the real @huggingface/transformers runtime — that can
// only be validated by actually loading the built extension in Chrome (see
// SDD/CAREER_PILOT_LOCAL_SEMANTIC_RETRIEVAL_SDD.md section 9).
const extractorMock = vi.fn();
const pipelineMock = vi.fn(async () => extractorMock);

vi.mock("@huggingface/transformers", () => ({
  pipeline: (..._args: unknown[]) => pipelineMock(),
  // Minimal stub: real shape is `Partial<onnxruntime-common Env>` — only
  // what configureLocalWasmRuntime() touches needs to exist here. `chrome`
  // is undefined in this Node test environment, so that function returns
  // early and never actually writes to `wasm`.
  env: { backends: { onnx: { wasm: {} } } },
}));

function tensor(values: number[]) {
  return { data: Float32Array.from(values) };
}

describe("runEmbeddingSpike", () => {
  beforeEach(() => {
    vi.resetModules();
    pipelineMock.mockClear();
    extractorMock.mockReset();
  });

  it("reports VIABLE with a 384-dim, finite, normalized embedding pair and a cosine similarity", async () => {
    const dim = 384;
    const query = Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0));
    const passage = Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0)); // identical -> cosine 1
    extractorMock.mockResolvedValueOnce(tensor(query)).mockResolvedValueOnce(tensor(passage));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.overall).toBe("VIABLE");
    expect(report.embeddingDimension).toBe(384);
    expect(report.allFinite).toBe(true);
    expect(report.cosineSimilarity).toBeCloseTo(1, 10);
  });

  it("computes ~0 cosine similarity for orthogonal embeddings", async () => {
    const query = [1, 0, 0];
    const passage = [0, 1, 0];
    extractorMock.mockResolvedValueOnce(tensor(query)).mockResolvedValueOnce(tensor(passage));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.cosineSimilarity).toBeCloseTo(0, 10);
  });

  it("uses the 'query: ' prefix for the requirement text and 'passage: ' for the profile text", async () => {
    extractorMock.mockResolvedValueOnce(tensor([1, 0])).mockResolvedValueOnce(tensor([0, 1]));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    await runEmbeddingSpike();

    const [firstCallText] = extractorMock.mock.calls[0] as [string];
    const [secondCallText] = extractorMock.mock.calls[1] as [string];
    expect(firstCallText.startsWith("query: ")).toBe(true);
    expect(secondCallText.startsWith("passage: ")).toBe(true);
  });

  it("reports VIABLE_WITH_CONCERNS when the embedding dimension is not 384", async () => {
    extractorMock.mockResolvedValueOnce(tensor([1, 0, 0])).mockResolvedValueOnce(tensor([0, 1, 0]));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.embeddingDimension).toBe(3);
    expect(report.overall).toBe("VIABLE_WITH_CONCERNS");
  });

  it("reports VIABLE_WITH_CONCERNS when any embedding value is non-finite", async () => {
    const dim = 384;
    const query = Array.from({ length: dim }, () => 0);
    query[0] = Number.NaN;
    const passage = Array.from({ length: dim }, () => 0.1);
    extractorMock.mockResolvedValueOnce(tensor(query)).mockResolvedValueOnce(tensor(passage));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.allFinite).toBe(false);
    expect(report.overall).toBe("VIABLE_WITH_CONCERNS");
  });

  it("reports NOT_VIABLE and captures the exact error when the pipeline fails to initialize", async () => {
    pipelineMock.mockRejectedValueOnce(new Error("failed to fetch model assets"));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.overall).toBe("NOT_VIABLE");
    expect(report.error?.message).toBe("failed to fetch model assets");
    expect(report.steps.some((s) => s.step === "exception" && !s.ok)).toBe(true);
  });

  it("reports NOT_VIABLE and captures the error when embedding generation throws", async () => {
    extractorMock.mockRejectedValueOnce(new Error("WASM backend crashed"));

    const { runEmbeddingSpike } = await import("../../src/extension/background/embeddingSpike.js");
    const report = await runEmbeddingSpike();

    expect(report.overall).toBe("NOT_VIABLE");
    expect(report.error?.message).toBe("WASM backend crashed");
  });
});
