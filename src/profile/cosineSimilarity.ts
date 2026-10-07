/**
 * Pure, deterministic cosine similarity (SDD "Local Semantic Retrieval"
 * section 11). Invalid inputs fail safely — they return `0` (the lowest
 * possible similarity) rather than throwing or propagating `NaN`, since a
 * single malformed embedding must never crash an entire retrieval pass
 * (graceful degradation, section 14).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(similarity) ? similarity : 0;
}
