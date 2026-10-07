import { describe, expect, it } from "vitest";
import { SemanticRetriever, rescaleCosineSimilarity } from "../src/profile/semanticRetriever.js";
import type { ProfileChunk } from "../src/profile/types.js";
import { FakeEmbeddingProvider } from "./fixtures/fakeEmbeddingProvider.js";

function chunk(id: string, content: string): ProfileChunk {
  return {
    id,
    profileId: "rodrigo-matos",
    documentId: `${id}-doc`,
    type: "skills",
    content,
    path: `skills/${id}.md`,
    tags: [],
  };
}

describe("rescaleCosineSimilarity", () => {
  it("clamps the documented ~0.7-1.0 e5 cluster down to 0-1", () => {
    expect(rescaleCosineSimilarity(0.7)).toBeCloseTo(0, 10);
    expect(rescaleCosineSimilarity(1.0)).toBeCloseTo(1, 10);
    expect(rescaleCosineSimilarity(0.85)).toBeCloseTo(0.5, 10);
  });

  it("clamps below 0.7 to 0 and above 1.0 to 1 (never negative/over 1)", () => {
    expect(rescaleCosineSimilarity(0.3)).toBe(0);
    expect(rescaleCosineSimilarity(-1)).toBe(0);
    expect(rescaleCosineSimilarity(1.5)).toBe(1);
  });
});

describe("SemanticRetriever", () => {
  const chunks = [
    chunk("autonomy", "Teams own their technical and product decisions with autonomy."),
    chunk("bureaucracy", "Avoid bureaucracy for its own sake; prefer distributed decision making."),
    chunk("unrelated", "Favorite hobby: photographing cats and dogs on weekends."),
  ];

  it("ranks the topically matching chunk above an unrelated one", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy", "bureaucracy", "cats"]);
    const retriever = new SemanticRetriever(chunks, provider, { minScore: 0.5 });

    const results = await retriever.search("autonomia para atuar com autonomy", { topK: 5 });

    expect(results[0].chunk.id).toBe("autonomy");
    expect(results.some((r) => r.chunk.id === "unrelated")).toBe(false); // orthogonal -> rescaled to 0, filtered by minScore
  });

  it("uses the 'query: ' prefix for the search text and 'passage: ' for indexed chunks", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy"]);
    const retriever = new SemanticRetriever(chunks, provider, { minScore: 0 });

    await retriever.search("autonomy");

    const [chunkEmbedCall, queryEmbedCall] = provider.calls;
    expect(chunkEmbedCall.every((text) => text.startsWith("passage: "))).toBe(true);
    expect(queryEmbedCall).toEqual(["query: autonomy"]);
  });

  it("embeds the profile chunks only once, even across multiple searches (cached index)", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy", "bureaucracy", "cats"]);
    const retriever = new SemanticRetriever(chunks, provider, { minScore: 0 });

    await retriever.search("autonomy");
    await retriever.search("bureaucracy");
    await retriever.search("cats");

    const chunkEmbeddingCalls = provider.calls.filter((call) => call.length === chunks.length);
    expect(chunkEmbeddingCalls).toHaveLength(1);
  });

  it("throws NO_RELEVANT_CONTEXT when the profile has no chunks", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy"]);
    const retriever = new SemanticRetriever([], provider);

    await expect(retriever.search("autonomy")).rejects.toMatchObject({ code: "NO_RELEVANT_CONTEXT" });
  });

  it("throws NO_RELEVANT_CONTEXT when nothing clears minScore", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy", "cats"]);
    const retriever = new SemanticRetriever([chunk("unrelated", "cats and dogs")], provider, { minScore: 0.5 });

    await expect(retriever.search("autonomy")).rejects.toMatchObject({ code: "NO_RELEVANT_CONTEXT" });
  });

  it("respects topK", async () => {
    const provider = new FakeEmbeddingProvider(["autonomy"]);
    const many = Array.from({ length: 10 }, (_, i) => chunk(`c${i}`, "discussion about autonomy at work"));
    const retriever = new SemanticRetriever(many, provider, { minScore: 0 });

    const results = await retriever.search("autonomy", { topK: 3 });
    expect(results).toHaveLength(3);
  });
});
