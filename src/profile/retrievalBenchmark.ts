import { ProfileError } from "./errors.js";
import type { ProfileRetriever } from "./retriever.js";

/**
 * A known case to measure retrieval quality against: a job-requirement-like
 * query paired with the profile chunk that's known to be the correct
 * evidence for it (SDD "Local Semantic Retrieval" section 19 — Recall@3,
 * Recall@5, MRR). Matched by (path, title) rather than a raw chunk id,
 * since ids embed a slugified heading that's an implementation detail of
 * the chunker.
 */
export interface RetrievalBenchmarkCase {
  label: string;
  query: string;
  expectedChunkPath: string;
  expectedChunkTitle: string;
}

export interface RetrievalBenchmarkCaseResult {
  label: string;
  query: string;
  expectedChunkPath: string;
  expectedChunkTitle: string;
  /** 1-based rank of the expected chunk in the retriever's results, or null if absent from the top results searched. */
  rank: number | null;
  foundInTop3: boolean;
  foundInTop5: boolean;
}

export interface RetrievalBenchmarkReport {
  cases: RetrievalBenchmarkCaseResult[];
  recallAt3: number;
  recallAt5: number;
  mrr: number;
}

/**
 * Pure, retriever-agnostic benchmark runner (domain layer, no Chrome
 * dependency) — the same cases can be run against a KeywordRetriever, a
 * SemanticRetriever or a HybridRetriever to compare them directly.
 */
export async function runRetrievalBenchmark(
  retriever: ProfileRetriever,
  cases: RetrievalBenchmarkCase[]
): Promise<RetrievalBenchmarkReport> {
  const results: RetrievalBenchmarkCaseResult[] = [];

  for (const testCase of cases) {
    let topResults: Array<{ chunk: { path: string; title?: string } }> = [];
    try {
      topResults = await retriever.search(testCase.query, { topK: 5, minScore: 0 });
    } catch (cause) {
      if (!(cause instanceof ProfileError && cause.code === "NO_RELEVANT_CONTEXT")) {
        throw cause;
      }
    }

    const index = topResults.findIndex(
      (result) => result.chunk.path === testCase.expectedChunkPath && result.chunk.title === testCase.expectedChunkTitle
    );
    const rank = index === -1 ? null : index + 1;

    results.push({
      label: testCase.label,
      query: testCase.query,
      expectedChunkPath: testCase.expectedChunkPath,
      expectedChunkTitle: testCase.expectedChunkTitle,
      rank,
      foundInTop3: rank !== null && rank <= 3,
      foundInTop5: rank !== null && rank <= 5,
    });
  }

  const total = results.length || 1;
  const recallAt3 = results.filter((result) => result.foundInTop3).length / total;
  const recallAt5 = results.filter((result) => result.foundInTop5).length / total;
  const mrr = results.reduce((sum, result) => sum + (result.rank ? 1 / result.rank : 0), 0) / total;

  return { cases: results, recallAt3, recallAt5, mrr };
}
