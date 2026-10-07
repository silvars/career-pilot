import { DefaultProfileManager } from "../../profile/profileManager.js";
import { buildIndex } from "../../profile/chunker.js";
import { KeywordRetriever } from "../../profile/retriever.js";
import { SemanticRetriever } from "../../profile/semanticRetriever.js";
import { HybridRetriever } from "../../profile/hybridRetriever.js";
import { runRetrievalBenchmark } from "../../profile/retrievalBenchmark.js";
import { RETRIEVAL_BENCHMARK_CASES } from "./retrievalBenchmarkCases.js";
import { buildFormIntelligenceResult } from "../../form-intelligence/formIntelligence.js";
import type { RawFormMaterials } from "../../form-intelligence/extraction/rawFormElement.js";
import { RuleBasedJobAnalyzer, RuleBasedMatchEngine } from "../../job-match/index.js";
import { ChromeProfileLoader } from "../profile/chromeProfileLoader.js";
import { ChromeJobPageSource, isSupportedPageUrl } from "../job-extraction/index.js";
import { ExtensionError, toErrorPayload } from "../errors.js";
import { handleMessage } from "../messaging/message-handler.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";
import { ensureOffscreenDocument } from "./offscreenDocument.js";
import { OffscreenEmbeddingProvider } from "../embeddings/offscreenEmbeddingProvider.js";
// FASE 4.1-A/B viability spikes ONLY — kept as a manually-reachable
// diagnostic (not auto-run), now that FASE 4.1 (Local Semantic Retrieval)
// is the real, always-on implementation below.
import { runEmbeddingSpike } from "./embeddingSpike.js";
import type { EmbeddingSpikeReport } from "./embeddingSpike.js";
import {
  createInitialState,
  withFormIntelligenceError,
  withFormIntelligenceResult,
  withFormIntelligenceStatus,
  withInitialized,
  withJobMatchError,
  withJobMatchResult,
  withJobMatchStatus,
} from "../state/extension-state.js";
import type { ExtensionState } from "../state/extension-state.js";

// Hardcoded for FASE 3: a single bundled profile. Multi-profile selection
// (SDD Profile Reader section 26) is not part of this phase.
const ACTIVE_PROFILE_ID = "rodrigo-matos";

const profileManager = new DefaultProfileManager(new ChromeProfileLoader());
const jobPageSource = new ChromeJobPageSource();
const jobAnalyzer = new RuleBasedJobAnalyzer();
const embeddingProvider = new OffscreenEmbeddingProvider();

/**
 * Rebuilt once per profile load (SDD "Local Semantic Retrieval" section 10:
 * "loading another profile must invalidate the previous semantic index") —
 * `null` until `initialize()` completes, so the very first HybridRetriever
 * calls before that gracefully degrade to keyword-only (handled by
 * HybridRetriever itself).
 */
let semanticRetriever: SemanticRetriever | null = null;

// MatchEngine stays scoring-agnostic: this factory is the only integration
// point between it and semantic retrieval. HybridRetriever itself handles
// graceful degradation (falls back to keyword-only) if the offscreen
// embedding runtime is unavailable or times out for a given call — nothing
// here needs to know whether that happened.
const matchEngine = new RuleBasedMatchEngine(
  (chunks) => new HybridRetriever(new KeywordRetriever(chunks), semanticRetriever)
);
let state: ExtensionState = createInitialState();
let initPromise: Promise<void> | null = null;

/**
 * Service workers are ephemeral (SDD section 12: "must work after Service
 * Worker restarts") — this runs once per wake-up via the module-level call
 * below, not only on install.
 */
async function initialize(): Promise<void> {
  try {
    const profile = await profileManager.load(ACTIVE_PROFILE_ID);
    state = withInitialized(state, profile.id);
    semanticRetriever = new SemanticRetriever(buildIndex(profile).chunks, embeddingProvider);
  } catch (cause) {
    throw new ExtensionError(
      "EXTENSION_INITIALIZATION_FAILED",
      `Failed to initialize CareerPilot: ${String(cause)}`
    );
  }
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize();
  }
  return initPromise;
}

function getExtensionStatus(): ExtensionResponse {
  return {
    success: true,
    data: { initialized: state.initialized, activeProfileId: state.activeProfileId },
  };
}

async function getActiveProfile(): Promise<ExtensionResponse> {
  const profile = profileManager.getActiveProfile();
  if (!profile) {
    return {
      success: false,
      error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." },
    };
  }
  return { success: true, data: { id: profile.id, name: profile.name } };
}

/** Relays a message to the content script of the current active tab (SDD section 8). */
async function relayToContentScript(message: ExtensionMessage): Promise<ExtensionResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return {
      success: false,
      error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: "No active tab found." },
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as ExtensionResponse | undefined;
    if (!response) {
      return {
        success: false,
        error: {
          code: "CONTENT_SCRIPT_UNAVAILABLE",
          message: "Content script did not respond (unsupported page or not loaded).",
        },
      };
    }
    return response;
  } catch (cause) {
    return {
      success: false,
      error: {
        code: "CONTENT_SCRIPT_UNAVAILABLE",
        message: `Content script unavailable on this page: ${String(cause)}`,
      },
    };
  }
}

/**
 * Orchestrates the full FASE 4 flow (SDD section 18): active tab/URL checks
 * are Chrome-specific concerns handled here, not inside ChromeJobPageSource;
 * extraction/analysis/matching errors are domain errors translated via
 * toErrorPayload (src/extension/errors.ts).
 */
async function analyzeCurrentJob(): Promise<ExtensionResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return {
      success: false,
      error: { code: "CURRENT_TAB_NOT_AVAILABLE", message: "No active tab found." },
    };
  }
  if (!isSupportedPageUrl(tab.url)) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_PAGE",
        message: `This page cannot be analyzed: ${tab.url ?? "unknown URL"}`,
      },
    };
  }

  const profile = profileManager.getActiveProfile();
  if (!profile) {
    return {
      success: false,
      error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." },
    };
  }

  state = withJobMatchStatus(state, "analyzing");

  try {
    const job = await jobPageSource.getCurrentJobPage();
    const requirements = await jobAnalyzer.analyze(job);
    const result = await matchEngine.evaluate(requirements, profile);

    state = withJobMatchResult(state, result);
    return { success: true, data: result };
  } catch (cause) {
    const error = toErrorPayload(cause);
    state = withJobMatchError(state, error);
    return { success: false, error };
  }
}

/** Returns the last completed analysis, if any — does not trigger a new one (SDD section 28). */
function getMatchResult(): ExtensionResponse {
  return { success: true, data: state.jobMatch.result };
}

/**
 * FASE 5 (Form Intelligence) orchestration: relays EXTRACT_FORM to the
 * content script for the raw DOM snapshot, then runs it through the
 * existing classification/retrieval/answer pipeline
 * (`buildFormIntelligenceResult`) using the same HybridRetriever
 * construction as MatchEngine (no new retrieval mechanism). Strictly
 * read-only — never touches the DOM, never fills/selects/submits anything.
 */
async function analyzeForm(): Promise<ExtensionResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return {
      success: false,
      error: { code: "CURRENT_TAB_NOT_AVAILABLE", message: "No active tab found." },
    };
  }

  const profile = profileManager.getActiveProfile();
  if (!profile) {
    return {
      success: false,
      error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." },
    };
  }

  state = withFormIntelligenceStatus(state, "analyzing");

  try {
    const extraction = await relayToContentScript({ type: "EXTRACT_FORM" });
    if (!extraction.success) {
      const error = extraction.error ?? {
        code: "FORM_EXTRACTION_FAILED" as const,
        message: "Content script did not return form materials.",
      };
      state = withFormIntelligenceError(state, error);
      return { success: false, error };
    }

    const materials = extraction.data as RawFormMaterials;
    if (!materials.elements || materials.elements.length === 0) {
      const error = { code: "NO_FORM_CONTENT" as const, message: "No form fields found on this page." };
      state = withFormIntelligenceError(state, error);
      return { success: false, error };
    }

    const chunks = buildIndex(profile).chunks;
    const retriever = new HybridRetriever(new KeywordRetriever(chunks), semanticRetriever);
    const result = await buildFormIntelligenceResult(materials, { retriever });

    state = withFormIntelligenceResult(state, result);
    return { success: true, data: result };
  } catch (cause) {
    const error = toErrorPayload(cause);
    state = withFormIntelligenceError(state, error);
    return { success: false, error };
  }
}

/** Returns the last completed form analysis, if any — does not trigger a new one. */
function getFormIntelligence(): ExtensionResponse {
  return { success: true, data: state.formIntelligence.result };
}

/**
 * FASE 4.1 (Local Semantic Retrieval) quality benchmark: runs the same
 * known false-negative cases (SDD/CAREER_PILOT_JOB_MATCH_CHROME_SDD.md
 * section 40.1) through a plain KeywordRetriever and through the real
 * HybridRetriever side by side, reporting Recall@3/Recall@5/MRR for each.
 * Real embedding quality can't be exercised under vitest/Node (no ONNX
 * runtime there), so this is manually reachable rather than asserted in an
 * automated test — trigger from the popup's devtools console:
 *   chrome.runtime.sendMessage({ type: "RUN_RETRIEVAL_BENCHMARK" }, console.log)
 */
async function runRetrievalBenchmarkHandler(): Promise<ExtensionResponse> {
  try {
    const profile = profileManager.getActiveProfile();
    if (!profile) {
      return {
        success: false,
        error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." },
      };
    }

    const chunks = buildIndex(profile).chunks;
    const keywordOnlyRetriever = new KeywordRetriever(chunks);
    const hybridRetriever = new HybridRetriever(keywordOnlyRetriever, semanticRetriever);

    const [keywordOnly, hybrid] = await Promise.all([
      runRetrievalBenchmark(keywordOnlyRetriever, RETRIEVAL_BENCHMARK_CASES),
      runRetrievalBenchmark(hybridRetriever, RETRIEVAL_BENCHMARK_CASES),
    ]);

    const report = { keywordOnly, hybrid };
    console.log("[CareerPilot][retrieval-benchmark] keyword-only vs hybrid:", report);
    console.table(keywordOnly.cases);
    console.table(hybrid.cases);
    return { success: true, data: report };
  } catch (cause) {
    // Belt-and-suspenders: handleMessage's own try/catch already covers this,
    // but this handler must never let an unexpected rejection escape
    // unanswered — always resolve to an explicit success/error response.
    const error = toErrorPayload(cause);
    console.error("[CareerPilot][retrieval-benchmark] failed:", cause);
    return { success: false, error };
  }
}


// FASE 4.1-A viability spike ONLY (remove once the decision gate is
// resolved): kept for reference/comparison, but no longer auto-run — FASE
// 4.1-A already concluded NOT_VIABLE in the service worker ("no available
// backend found. ERR: [wasm]"). Still reachable on demand from the popup's
// devtools console:
//   chrome.runtime.sendMessage({ type: "RUN_EMBEDDING_SPIKE" }, console.log)
async function runEmbeddingSpikeHandler(): Promise<ExtensionResponse> {
  const report = await runEmbeddingSpike();
  console.log("[CareerPilot][spike] embedding runtime report:", report);
  console.table(report.steps);
  return { success: true, data: report };
}

// FASE 4.1-B viability spike ONLY (kept as a manually-reachable diagnostic,
// see runEmbeddingSpikeHandler's comment above for how to trigger it):
// reuses the shared ensureOffscreenDocument (./offscreenDocument.js), the
// same helper the real OffscreenEmbeddingProvider uses.

/**
 * Real finding (2026-10-07): a plain `chrome.runtime.sendMessage` round
 * trip to the offscreen document intermittently failed with "message
 * channel closed before a response was received" — merely `await`-ing a
 * promise does not count as "active work" that keeps the service worker
 * alive under MV3, so Chrome's idle timer could fire mid-wait (the
 * embedding runtime can take several seconds) and tear down the channel
 * before the offscreen document replied. A long-lived `chrome.runtime.Port`
 * (via `connect`/`onConnect`, instead of `sendMessage`/`onMessage`) is
 * Chrome's documented fix: an open port is itself a reason to keep the
 * service worker alive for as long as it stays connected.
 */
const OFFSCREEN_PORT_NAME = "offscreen-embedding-spike";

async function runOffscreenEmbeddingSpikeHandler(): Promise<ExtensionResponse> {
  const creationStart = performance.now();
  await ensureOffscreenDocument();
  const offscreenReadyMs = performance.now() - creationStart;

  const report = await new Promise<EmbeddingSpikeReport>((resolve, reject) => {
    const port = chrome.runtime.connect({ name: OFFSCREEN_PORT_NAME });
    port.onMessage.addListener((message: EmbeddingSpikeReport) => {
      resolve(message);
      port.disconnect();
    });
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });
  const fullReport = { ...report, offscreenReadyMs };

  console.log("[CareerPilot][offscreen-spike] report:", fullReport);
  console.table(fullReport.steps ?? []);
  return { success: true, data: fullReport };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ensureInitialized()
    .then(() =>
      handleMessage(message, {
        getExtensionStatus,
        getActiveProfile,
        relayToContentScript,
        analyzeCurrentJob,
        getMatchResult,
        runEmbeddingSpike: runEmbeddingSpikeHandler,
        runOffscreenEmbeddingSpike: runOffscreenEmbeddingSpikeHandler,
        runRetrievalBenchmark: runRetrievalBenchmarkHandler,
        analyzeForm,
        getFormIntelligence,
      })
    )
    .then(sendResponse)
    .catch((cause) => sendResponse({ success: false, error: toErrorPayload(cause) }));
  return true; // keep the message channel open for the async sendResponse above
});

// Single entry point for initialization (shares the cached initPromise with
// the message listener above) — avoids loading the profile twice on cold start.
ensureInitialized().catch((cause) => {
  // Logged for local diagnostics only (SDD section 21) — never surfaced with
  // internal details to the popup beyond the error code/message above.
  console.error("[CareerPilot] initialization failed:", cause);
});
