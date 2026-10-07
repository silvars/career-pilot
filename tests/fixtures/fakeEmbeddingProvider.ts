import type { EmbeddingProvider } from "../../src/profile/embeddingProvider.js";

/**
 * Deterministic, controllable fake for domain-level semantic retrieval
 * tests — no real model/network involved. Builds a tiny bag-of-keywords
 * vector per text (one dimension per configured keyword; 1 if present,
 * case-insensitive substring match, 0 otherwise), so tests can express
 * "this text is about X" directly instead of needing real embeddings.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  public readonly calls: string[][] = [];

  constructor(private readonly vocabulary: string[]) {}

  async embed(texts: string[]): Promise<Float32Array[]> {
    this.calls.push(texts);
    return texts.map((text) => {
      const lower = text.toLowerCase();
      return Float32Array.from(this.vocabulary.map((word) => (lower.includes(word) ? 1 : 0)));
    });
  }
}
