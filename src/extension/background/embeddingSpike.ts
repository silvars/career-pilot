import { pipeline } from "@huggingface/transformers";
import { configureLocalWasmRuntime } from "../offscreen/embeddingRuntime.js";

/**
 * FASE 4.1-A/B SPIKE ONLY — answers whether the embedding runtime can
 * initialize and run inside the service worker (4.1-A) or an Offscreen
 * Document (4.1-B). Throwaway/diagnostic code, not the final
 * SemanticRetriever architecture (see
 * SDD/CAREER_PILOT_LOCAL_SEMANTIC_RETRIEVAL_SDD.md). To be removed or
 * replaced once the viability decision is made.
 *
 * Remote MODEL loading (the HF CDN default) is used here TEMPORARILY to
 * isolate the runtime-viability question from the separate "vendor local
 * model assets" question — this is explicitly not acceptable for the final
 * local-first architecture (spec section 3).
 *
 * The WASM runtime factory (.wasm/.mjs) is a different story: by default,
 * `@huggingface/transformers` points it at a remote jsdelivr CDN URL
 * whenever it isn't already set and the code isn't running inside a
 * ServiceWorkerGlobalScope (see its own `backends/onnx.js`). Real finding
 * (2026-10-07, Offscreen Document spike): MV3's default CSP (`script-src
 * 'self'`) blocks that remote script load outright —
 * "Loading the script '...ort-wasm-simd-threaded.asyncify.mjs' violates
 * ... script-src 'self'". This is a hard MV3 security restriction, not an
 * Offscreen-specific bug — it would block the service worker the same way
 * if it ever got that far. Fix: point `wasmPaths` at the copies of those
 * exact two files this project's build vendors into dist/ (see
 * scripts/build-extension.mjs) instead of letting the library default to
 * the CDN.
 */

const MODEL_ID = "Xenova/multilingual-e5-small";
const EXPECTED_DIMENSION = 384;

export interface SpikeStep {
  step: string;
  ok: boolean;
  ms?: number;
  error?: string;
}

export interface EmbeddingSpikeReport {
  startedAt: string;
  transformersVersion: string;
  device: "wasm";
  modelId: string;
  steps: SpikeStep[];
  initMs?: number;
  firstEmbeddingMs?: number;
  secondEmbeddingMs?: number;
  embeddingDimension?: number;
  queryEmbeddingSample?: number[];
  passageEmbeddingSample?: number[];
  allFinite?: boolean;
  cosineSimilarity?: number;
  overall: "VIABLE" | "VIABLE_WITH_CONCERNS" | "NOT_VIABLE";
  error?: { message: string; stack?: string };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return NaN;
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
    return NaN;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Runs once (per invocation) and reports everything needed for the spike's decision gate — never throws. */
export async function runEmbeddingSpike(): Promise<EmbeddingSpikeReport> {
  const steps: SpikeStep[] = [];
  const report: EmbeddingSpikeReport = {
    startedAt: new Date().toISOString(),
    transformersVersion: "4.3.1",
    device: "wasm",
    modelId: MODEL_ID,
    steps,
    overall: "NOT_VIABLE",
  };

  try {
    configureLocalWasmRuntime();

    const initStart = performance.now();
    const extractor = await pipeline("feature-extraction", MODEL_ID, { device: "wasm", dtype: "q8" });
    report.initMs = performance.now() - initStart;
    steps.push({ step: "pipeline-init", ok: true, ms: report.initMs });

    const firstStart = performance.now();
    const queryOutput = await extractor(
      "query: strong technical leadership and software architecture experience",
      { pooling: "mean", normalize: true }
    );
    report.firstEmbeddingMs = performance.now() - firstStart;
    steps.push({ step: "first-embedding (query)", ok: true, ms: report.firstEmbeddingMs });

    const secondStart = performance.now();
    const passageOutput = await extractor(
      "passage: I stay technically close enough to challenge architecture and participate in technical decisions.",
      { pooling: "mean", normalize: true }
    );
    report.secondEmbeddingMs = performance.now() - secondStart;
    steps.push({ step: "second-embedding (passage)", ok: true, ms: report.secondEmbeddingMs });

    const queryVec = Array.from(queryOutput.data as Float32Array);
    const passageVec = Array.from(passageOutput.data as Float32Array);

    report.embeddingDimension = queryVec.length;
    report.queryEmbeddingSample = queryVec.slice(0, 5);
    report.passageEmbeddingSample = passageVec.slice(0, 5);
    report.allFinite = [...queryVec, ...passageVec].every((value) => Number.isFinite(value));
    report.cosineSimilarity = cosineSimilarity(queryVec, passageVec);

    const dimensionOk = report.embeddingDimension === EXPECTED_DIMENSION;
    steps.push({ step: `dimension-check (expected ${EXPECTED_DIMENSION})`, ok: dimensionOk });
    steps.push({ step: "finite-values-check", ok: report.allFinite });

    report.overall = dimensionOk && report.allFinite ? "VIABLE" : "VIABLE_WITH_CONCERNS";
  } catch (cause) {
    const err = cause instanceof Error ? cause : new Error(String(cause));
    report.error = { message: err.message, stack: err.stack };
    steps.push({ step: "exception", ok: false, error: err.message });
    report.overall = "NOT_VIABLE";
  }

  return report;
}
