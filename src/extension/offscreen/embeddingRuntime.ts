import { env, pipeline } from "@huggingface/transformers";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Real (non-spike) embedding runtime for the Offscreen Document (SDD
 * "Local Semantic Retrieval" section 8). Deliberately model-agnostic/dumb
 * about retrieval semantics — the "query: "/"passage: " prefixing lives in
 * `src/profile/semanticRetriever.ts`, not here, so this module stays a
 * thin, swappable wrapper around whichever embedding model is configured.
 */
const MODEL_ID = "Xenova/multilingual-e5-small";
// Matches the asyncify suffix `@huggingface/transformers` picks by default
// (backends/onnx.js) for non-Safari browsers — vendored as-is rather than
// fighting that default selection (see scripts/build-extension.mjs).
const WASM_FACTORY_BASENAME = "ort-wasm-simd-threaded.asyncify";

function resolveLocalAssetUrl(path: string): string | undefined {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return undefined;
}

/**
 * Points the ONNX WASM runtime at the locally-vendored factory files
 * instead of `@huggingface/transformers`'s remote CDN default — MV3's CSP
 * (`script-src 'self'`) blocks that remote script load outright (real
 * finding, FASE 4.1-B spike).
 */
export function configureLocalWasmRuntime(): void {
  const wasmUrl = resolveLocalAssetUrl(`${WASM_FACTORY_BASENAME}.wasm`);
  const mjsUrl = resolveLocalAssetUrl(`${WASM_FACTORY_BASENAME}.mjs`);
  if (wasmUrl && mjsUrl && env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
  }
}

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

/** Loads the pipeline once and reuses it for the Offscreen Document's lifetime — never recreated per request. */
function loadPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    configureLocalWasmRuntime();
    pipelinePromise = pipeline("feature-extraction", MODEL_ID, { device: "wasm", dtype: "q8" });
  }
  return pipelinePromise;
}

/**
 * Embeds each text in turn (not batched) — matches the exact call shape
 * already proven viable in the FASE 4.1-B spike, rather than risking an
 * unverified batched-call code path for a general-purpose entry point.
 */
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const extractor = await loadPipeline();
  const embeddings: Float32Array[] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    embeddings.push(Float32Array.from(output.data as Float32Array));
  }
  return embeddings;
}
