/**
 * Retrieval-layer configuration (SDD "Local Semantic Retrieval" section 13):
 * deliberately separate from `MatchScoringConfig` (src/job-match/scoringConfig.ts)
 * — retrieval weights/thresholds and scoring weights/thresholds are
 * different concerns and must not be conflated.
 */
export interface SemanticRetrievalConfig {
  topK?: number;
  /** Applied to the *rescaled* score (see semanticRetriever.ts), not the raw cosine value. */
  minScore?: number;
}

export interface HybridRetrievalConfig {
  lexicalWeight?: number;
  semanticWeight?: number;
  topK?: number;
  /**
   * Upper bound on how long the semantic branch is allowed to take before
   * HybridRetriever gives up on it and falls back to keyword-only results
   * for that call (graceful degradation, SDD "Local Semantic Retrieval"
   * section 14) — without this, a stuck/unresponsive Offscreen Document
   * (e.g. the embedding runtime never replies) would hang the entire job
   * match indefinitely instead of degrading.
   */
  semanticTimeoutMs?: number;
}

export const DEFAULT_SEMANTIC_RETRIEVAL_CONFIG: Required<SemanticRetrievalConfig> = {
  topK: 5,
  minScore: 0,
};

export const DEFAULT_HYBRID_RETRIEVAL_CONFIG: Required<HybridRetrievalConfig> = {
  lexicalWeight: 0.5,
  semanticWeight: 0.5,
  topK: 5,
  // Generous: covers cold-start pipeline init (~2-11s observed in the FASE
  // 4.1-B spike) plus embedding every profile chunk once.
  semanticTimeoutMs: 20_000,
};
