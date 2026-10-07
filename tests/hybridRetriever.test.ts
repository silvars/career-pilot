import { describe, expect, it, vi } from "vitest";
import { HybridRetriever } from "../src/profile/hybridRetriever.js";
import { ProfileError } from "../src/profile/errors.js";
import type { ProfileRetriever } from "../src/profile/retriever.js";
import type { ProfileChunk, RetrievalResult } from "../src/profile/types.js";

function chunk(id: string): ProfileChunk {
  return {
    id,
    profileId: "rodrigo-matos",
    documentId: `${id}-doc`,
    type: "skills",
    content: `content for ${id}`,
    path: `skills/${id}.md`,
    tags: [],
  };
}

function fakeRetriever(results: RetrievalResult[] | Error): ProfileRetriever {
  return {
    search: vi.fn(async () => {
      if (results instanceof Error) throw results;
      return results;
    }),
  };
}

describe("HybridRetriever", () => {
  it("blends lexical and semantic scores with the configured weights", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("a"), score: 0.8 }]);
    const semantic = fakeRetriever([{ chunk: chunk("a"), score: 0.4 }]);
    const hybrid = new HybridRetriever(keyword, semantic, { lexicalWeight: 0.6, semanticWeight: 0.4 });

    const [result] = await hybrid.search("query");

    expect(result.retrievalSource).toBe("HYBRID");
    expect(result.lexicalScore).toBe(0.8);
    expect(result.semanticScore).toBe(0.4);
    expect(result.finalRetrievalScore).toBeCloseTo(0.6 * 0.8 + 0.4 * 0.4, 10);
    expect(result.score).toBeCloseTo(result.finalRetrievalScore!, 10);
  });

  it("merges results found by only one of the two retrievers", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("only-lexical"), score: 0.9 }]);
    const semantic = fakeRetriever([{ chunk: chunk("only-semantic"), score: 0.7 }]);
    const hybrid = new HybridRetriever(keyword, semantic);

    const results = await hybrid.search("query");
    const byId = new Map(results.map((r) => [r.chunk.id, r]));

    expect(byId.get("only-lexical")).toMatchObject({ lexicalScore: 0.9, semanticScore: 0 });
    expect(byId.get("only-semantic")).toMatchObject({ lexicalScore: 0, semanticScore: 0.7 });
  });

  it("ranks merged results by the final blended score, descending", async () => {
    const keyword = fakeRetriever([
      { chunk: chunk("low"), score: 0.2 },
      { chunk: chunk("high"), score: 0.9 },
    ]);
    const semantic = fakeRetriever([]);
    const hybrid = new HybridRetriever(keyword, semantic);

    const results = await hybrid.search("query");
    expect(results.map((r) => r.chunk.id)).toEqual(["high", "low"]);
  });

  it("falls back to keyword-only results, tagged KEYWORD, when the semantic retriever throws a real failure", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("a"), score: 0.6 }]);
    const semantic = fakeRetriever(new Error("offscreen document unavailable"));
    const hybrid = new HybridRetriever(keyword, semantic);

    const results = await hybrid.search("query");

    expect(results).toEqual([{ chunk: chunk("a"), score: 0.6, retrievalSource: "KEYWORD" }]);
  });

  it("falls back to keyword-only results when constructed without a semantic retriever", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("a"), score: 0.6 }]);
    const hybrid = new HybridRetriever(keyword, null);

    const results = await hybrid.search("query");

    expect(results[0].retrievalSource).toBe("KEYWORD");
  });

  it("treats the semantic retriever's NO_RELEVANT_CONTEXT as 'no semantic matches' rather than a hard failure", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("a"), score: 0.6 }]);
    const semantic = fakeRetriever(new ProfileError("NO_RELEVANT_CONTEXT", "nothing found"));
    const hybrid = new HybridRetriever(keyword, semantic);

    const results = await hybrid.search("query");

    expect(results[0].retrievalSource).toBe("HYBRID");
    expect(results[0].semanticScore).toBe(0);
  });

  it("propagates the keyword retriever's NO_RELEVANT_CONTEXT as an empty result (not a thrown error)", async () => {
    const keyword = fakeRetriever(new ProfileError("NO_RELEVANT_CONTEXT", "nothing found"));
    const semantic = fakeRetriever(new ProfileError("NO_RELEVANT_CONTEXT", "nothing found"));
    const hybrid = new HybridRetriever(keyword, semantic);

    await expect(hybrid.search("query")).resolves.toEqual([]);
  });

  it("respects topK on the merged, blended result set", async () => {
    const keyword = fakeRetriever(
      Array.from({ length: 5 }, (_, i) => ({ chunk: chunk(`c${i}`), score: i / 10 }))
    );
    const semantic = fakeRetriever([]);
    const hybrid = new HybridRetriever(keyword, semantic, { topK: 2 });

    const results = await hybrid.search("query");
    expect(results).toHaveLength(2);
  });

  it("falls back to keyword-only when the semantic retriever takes longer than semanticTimeoutMs", async () => {
    const keyword = fakeRetriever([{ chunk: chunk("a"), score: 0.6 }]);
    const neverRespondsInTime: ProfileRetriever = {
      search: vi.fn(
        () =>
          new Promise<RetrievalResult[]>((resolve) =>
            setTimeout(() => resolve([{ chunk: chunk("a"), score: 1 }]), 50)
          )
      ),
    };
    const hybrid = new HybridRetriever(keyword, neverRespondsInTime, { semanticTimeoutMs: 5 });

    const results = await hybrid.search("query");

    expect(results).toEqual([{ chunk: chunk("a"), score: 0.6, retrievalSource: "KEYWORD" }]);
  });
});
