import { cosineSimilarity } from "./cosineSimilarity.js";
import { ProfileError } from "./errors.js";
import type { EmbeddingProvider } from "./embeddingProvider.js";
import type { ProfileRetriever } from "./retriever.js";
import { DEFAULT_SEMANTIC_RETRIEVAL_CONFIG } from "./retrievalConfig.js";
import type { SemanticRetrievalConfig } from "./retrievalConfig.js";
import type { ProfileChunk, RetrievalOptions, RetrievalResult } from "./types.js";

/**
 * intfloat/multilingual-e5-small (the model this was built against) is
 * trained with asymmetric "query: "/"passage: " prefixes and its own model
 * card is explicit that *without* them retrieval quality degrades — queries
 * use "query: ", indexed content uses "passage: ". Never mix them.
 */
const QUERY_PREFIX = "query: ";
const PASSAGE_PREFIX = "passage: ";

/**
 * Real, documented model behavior (multilingual-e5-small's own FAQ): raw
 * cosine similarity scores cluster between ~0.7 and ~1.0 regardless of
 * actual relevance — "what matters is the relative order of the scores
 * instead of the absolute values". Blending that raw score into
 * MatchEngine's existing MATCHED_THRESHOLD/PARTIAL_THRESHOLD (calibrated
 * against KeywordRetriever's 0-1 coverage score) would systematically
 * inflate everything and risk turning real absences into false matches —
 * exactly what we were told not to do. This rescales the documented ~[0.7,
 * 1.0] cluster back down to ~[0, 1] using the vendor's own published range
 * as the calibration anchor (not empirically tuned against this specific
 * profile — a known limitation, revisit if the benchmark shows it's off).
 */
export function rescaleCosineSimilarity(raw: number): number {
  const clustered = Math.max(0, Math.min(1, (raw - 0.7) / 0.3));
  return clustered;
}

/**
 * Semantic counterpart to KeywordRetriever (SDD "Local Semantic Retrieval"
 * section 9/12): same `ProfileRetriever` contract, so it's a drop-in
 * alternative or, combined via HybridRetriever, a complement. Profile chunk
 * embeddings are computed lazily and cached for the lifetime of this
 * instance — "embedded once", never re-embedded per requirement — and are
 * never shared across instances, which is what gives profile isolation
 * (each profile load constructs its own SemanticRetriever over its own
 * chunks only).
 */
export class SemanticRetriever implements ProfileRetriever {
  private indexPromise: Promise<Array<{ chunk: ProfileChunk; embedding: Float32Array }>> | null = null;

  constructor(
    private readonly chunks: ProfileChunk[],
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly config: SemanticRetrievalConfig = {}
  ) {}

  private buildIndex(): Promise<Array<{ chunk: ProfileChunk; embedding: Float32Array }>> {
    if (!this.indexPromise) {
      this.indexPromise = (async () => {
        if (this.chunks.length === 0) {
          return [];
        }
        const texts = this.chunks.map((chunk) => `${PASSAGE_PREFIX}${chunk.content}`);
        const embeddings = await this.embeddingProvider.embed(texts);
        return this.chunks.map((chunk, i) => ({ chunk, embedding: embeddings[i] }));
      })();
    }
    return this.indexPromise;
  }

  async search(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]> {
    const topK = options?.topK ?? this.config.topK ?? DEFAULT_SEMANTIC_RETRIEVAL_CONFIG.topK;
    const minScore = options?.minScore ?? this.config.minScore ?? DEFAULT_SEMANTIC_RETRIEVAL_CONFIG.minScore;

    const index = await this.buildIndex();
    if (index.length === 0) {
      throw new ProfileError("NO_RELEVANT_CONTEXT", "Semantic index is empty — no chunks to search.");
    }

    const [queryEmbedding] = await this.embeddingProvider.embed([`${QUERY_PREFIX}${query}`]);

    const scored = index.map(({ chunk, embedding }) => ({
      chunk,
      score: rescaleCosineSimilarity(cosineSimilarity(queryEmbedding, embedding)),
    }));

    const relevant = scored
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (relevant.length === 0) {
      throw new ProfileError("NO_RELEVANT_CONTEXT", `No semantically relevant context found for query: "${query}".`);
    }

    return relevant;
  }
}
