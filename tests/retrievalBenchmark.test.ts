import { describe, expect, it } from "vitest";
import { runRetrievalBenchmark } from "../src/profile/retrievalBenchmark.js";
import type { RetrievalBenchmarkCase } from "../src/profile/retrievalBenchmark.js";
import type { ProfileRetriever } from "../src/profile/retriever.js";
import { ProfileError } from "../src/profile/errors.js";
import type { ProfileChunk, RetrievalResult } from "../src/profile/types.js";

function chunk(path: string, title: string): ProfileChunk {
  return {
    id: `${path}--${title}`,
    profileId: "rodrigo-matos",
    documentId: path,
    type: "skills",
    title,
    content: "irrelevant for this test",
    path,
    tags: [],
  };
}

function retrieverReturning(resultsByQuery: Record<string, RetrievalResult[]>): ProfileRetriever {
  return {
    async search(query) {
      const results = resultsByQuery[query];
      if (!results || results.length === 0) {
        throw new ProfileError("NO_RELEVANT_CONTEXT", `no results for "${query}"`);
      }
      return results;
    },
  };
}

describe("runRetrievalBenchmark", () => {
  const autonomyChunk = chunk("skills/leadership.md", "Autonomy");
  const unrelatedChunk = chunk("skills/leadership.md", "Clarity");

  const cases: RetrievalBenchmarkCase[] = [
    {
      label: "autonomy",
      query: "team autonomy and ownership",
      expectedChunkPath: "skills/leadership.md",
      expectedChunkTitle: "Autonomy",
    },
  ];

  it("ranks the expected chunk at rank 1 and reports perfect recall/MRR when it's the top result", async () => {
    const retriever = retrieverReturning({
      "team autonomy and ownership": [{ chunk: autonomyChunk, score: 0.9 }],
    });

    const report = await runRetrievalBenchmark(retriever, cases);

    expect(report.cases[0].rank).toBe(1);
    expect(report.cases[0].foundInTop3).toBe(true);
    expect(report.recallAt3).toBe(1);
    expect(report.recallAt5).toBe(1);
    expect(report.mrr).toBe(1);
  });

  it("computes a fractional MRR and recall when the expected chunk is ranked lower", async () => {
    const retriever = retrieverReturning({
      "team autonomy and ownership": [
        { chunk: unrelatedChunk, score: 0.5 },
        { chunk: unrelatedChunk, score: 0.4 },
        { chunk: unrelatedChunk, score: 0.3 },
        { chunk: autonomyChunk, score: 0.2 },
      ],
    });

    const report = await runRetrievalBenchmark(retriever, cases);

    expect(report.cases[0].rank).toBe(4);
    expect(report.cases[0].foundInTop3).toBe(false);
    expect(report.cases[0].foundInTop5).toBe(true);
    expect(report.recallAt3).toBe(0);
    expect(report.recallAt5).toBe(1);
    expect(report.mrr).toBeCloseTo(0.25, 10);
  });

  it("treats NO_RELEVANT_CONTEXT as 'not found' rather than a hard failure", async () => {
    const retriever = retrieverReturning({});

    const report = await runRetrievalBenchmark(retriever, cases);

    expect(report.cases[0].rank).toBeNull();
    expect(report.recallAt3).toBe(0);
    expect(report.recallAt5).toBe(0);
    expect(report.mrr).toBe(0);
  });

  it("aggregates recall/MRR correctly across multiple cases", async () => {
    const multiCases: RetrievalBenchmarkCase[] = [
      { label: "hit", query: "q1", expectedChunkPath: "a.md", expectedChunkTitle: "A" },
      { label: "miss", query: "q2", expectedChunkPath: "b.md", expectedChunkTitle: "B" },
    ];
    const retriever = retrieverReturning({
      q1: [{ chunk: chunk("a.md", "A"), score: 1 }],
      q2: [{ chunk: chunk("c.md", "C"), score: 1 }],
    });

    const report = await runRetrievalBenchmark(retriever, multiCases);

    expect(report.recallAt3).toBe(0.5);
    expect(report.mrr).toBeCloseTo(0.5, 10);
  });
});
