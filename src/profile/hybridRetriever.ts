import { ProfileError } from "./errors.js";
import type { ProfileRetriever } from "./retriever.js";
import { DEFAULT_HYBRID_RETRIEVAL_CONFIG } from "./retrievalConfig.js";
import type { HybridRetrievalConfig } from "./retrievalConfig.js";
import type { ProfileChunk, RetrievalOptions, RetrievalResult } from "./types.js";

async function safeSearch(
  retriever: ProfileRetriever,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult[]> {
  try {
    return await retriever.search(query, options);
  } catch (cause) {
    if (cause instanceof ProfileError && cause.code === "NO_RELEVANT_CONTEXT") {
      return [];
    }
    throw cause;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Semantic retrieval timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      }
    );
  });
}

/**
 * Combines KeywordRetriever + SemanticRetriever (SDD "Local Semantic
 * Retrieval" section 13). Implements the same `ProfileRetriever` contract
 * as both, so it's a drop-in replacement wherever a retriever is expected
 * (e.g. MatchEngine).
 *
 * Graceful degradation (section 14): if the semantic retriever throws for
 * any reason other than "nothing relevant found" (model failed to load,
 * Offscreen Document unavailable, embedding failed, ...), this falls back
 * to keyword-only results and tags them `retrievalSource: "KEYWORD"` —
 * CareerPilot keeps working, it just loses the semantic boost for that call.
 */
export class HybridRetriever implements ProfileRetriever {
  constructor(
    private readonly keywordRetriever: ProfileRetriever,
    private readonly semanticRetriever: ProfileRetriever | null,
    private readonly config: HybridRetrievalConfig = {}
  ) {}

  async search(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]> {
    const topK = options?.topK ?? this.config.topK ?? DEFAULT_HYBRID_RETRIEVAL_CONFIG.topK;
    const lexicalWeight = this.config.lexicalWeight ?? DEFAULT_HYBRID_RETRIEVAL_CONFIG.lexicalWeight;
    const semanticWeight = this.config.semanticWeight ?? DEFAULT_HYBRID_RETRIEVAL_CONFIG.semanticWeight;
    const semanticTimeoutMs =
      this.config.semanticTimeoutMs ?? DEFAULT_HYBRID_RETRIEVAL_CONFIG.semanticTimeoutMs;

    const lexicalResults = await safeSearch(this.keywordRetriever, query, options);

    let semanticResults: RetrievalResult[] = [];
    let semanticAvailable = false;
    if (this.semanticRetriever) {
      try {
        semanticResults = await withTimeout(
          safeSearch(this.semanticRetriever, query, options),
          semanticTimeoutMs
        );
        semanticAvailable = true;
      } catch {
        semanticAvailable = false;
      }
    }

    if (!semanticAvailable) {
      return lexicalResults.map((result) => ({ ...result, retrievalSource: "KEYWORD" as const }));
    }

    const byChunkId = new Map<string, { chunk: ProfileChunk; lexicalScore: number; semanticScore: number }>();
    for (const result of lexicalResults) {
      byChunkId.set(result.chunk.id, { chunk: result.chunk, lexicalScore: result.score, semanticScore: 0 });
    }
    for (const result of semanticResults) {
      const existing = byChunkId.get(result.chunk.id);
      if (existing) {
        existing.semanticScore = result.score;
      } else {
        byChunkId.set(result.chunk.id, { chunk: result.chunk, lexicalScore: 0, semanticScore: result.score });
      }
    }

    const merged: RetrievalResult[] = Array.from(byChunkId.values()).map(
      ({ chunk, lexicalScore, semanticScore }) => {
        const finalRetrievalScore = lexicalWeight * lexicalScore + semanticWeight * semanticScore;
        return {
          chunk,
          score: finalRetrievalScore,
          lexicalScore,
          semanticScore,
          finalRetrievalScore,
          retrievalSource: "HYBRID" as const,
        };
      }
    );

    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, topK);
  }
}
