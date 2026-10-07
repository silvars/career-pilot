/**
 * Domain contract for turning text into embedding vectors (SDD
 * "Local Semantic Retrieval" section 4). Deliberately generic/minimal so the
 * underlying model/runtime stays swappable — implementations live outside
 * the domain (e.g. `src/extension/`) since they need a specific runtime
 * (ONNX/WASM, a remote API, etc.); the domain only depends on this
 * interface, never on Chrome APIs (architecture principle 10).
 */
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<Float32Array[]>;
}
