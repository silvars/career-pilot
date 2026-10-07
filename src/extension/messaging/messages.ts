import type { AutofillPlan } from "../../autofill/types/autofillAction.js";

/** Basic metadata the Content Script reports about the current page (SDD section 9). */
export interface PageContext {
  url: string;
  title: string;
}

/** All communication between Popup, Service Worker and Content Script uses this protocol (SDD section 11). */
export type ExtensionMessage =
  | { type: "GET_EXTENSION_STATUS" }
  | { type: "GET_ACTIVE_PROFILE" }
  | { type: "PING_CONTENT_SCRIPT" }
  | { type: "GET_PAGE_CONTEXT" }
  | { type: "EXTRACT_JOB_PAGE" }
  | { type: "ANALYZE_CURRENT_JOB" }
  | { type: "GET_MATCH_RESULT" }
  // FASE 4.1-A/B viability spikes ONLY — remove once the decision gate is resolved.
  | { type: "RUN_EMBEDDING_SPIKE" }
  | { type: "RUN_OFFSCREEN_EMBEDDING_SPIKE" }
  // FASE 4.1 (Local Semantic Retrieval): compares KeywordRetriever-only vs
  // HybridRetriever recall/MRR on the known false-negative cases — real
  // embedding quality can only be measured in actual Chrome (no ONNX
  // runtime under vitest/Node), so this is reachable on demand rather than
  // asserted in an automated test.
  | { type: "RUN_RETRIEVAL_BENCHMARK" }
  // FASE 5 (Form Intelligence): read-only form understanding — never fills,
  // selects or submits anything (see FORA DA FASE 5).
  | { type: "EXTRACT_FORM" }
  | { type: "ANALYZE_FORM" }
  | { type: "GET_FORM_INTELLIGENCE" }
  // FASE 6.1/6.2/6.3 (Autofill): BUILD_AUTOFILL_PLAN never touches the DOM
  // (pure planning from the last FormIntelligenceResult); EXECUTE_AUTOFILL_PLAN
  // is the only message that ever writes to the page, and only runs the
  // already-reviewed subset of actions the Popup sends (never rebuilt or
  // reclassified here).
  | { type: "BUILD_AUTOFILL_PLAN" }
  | { type: "GET_AUTOFILL_PLAN" }
  | { type: "EXECUTE_AUTOFILL_PLAN"; plan: AutofillPlan };

export type ExtensionMessageType = ExtensionMessage["type"];

export type ExtensionErrorCode =
  | "EXTENSION_INITIALIZATION_FAILED"
  | "INVALID_MESSAGE"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "PROFILE_NOT_LOADED"
  | "PROFILE_LOAD_FAILED"
  | "PAGE_CONTEXT_UNAVAILABLE"
  | "INTERNAL_ERROR"
  // FASE 4 (Job Match + Chrome SDD section 33):
  | "UNSUPPORTED_PAGE"
  | "PAGE_EXTRACTION_FAILED"
  | "NO_JOB_CONTENT"
  | "JOB_PAGE_TOO_LARGE"
  | "JOB_ANALYSIS_FAILED"
  | "MATCH_ANALYSIS_FAILED"
  | "PROFILE_CONTEXT_NOT_FOUND"
  | "CURRENT_TAB_NOT_AVAILABLE"
  // FASE 5 (Form Intelligence):
  | "NO_FORM_CONTENT"
  | "FORM_EXTRACTION_FAILED"
  | "FORM_ANALYSIS_FAILED"
  // FASE 6.3 (Autofill Review UI + Execution):
  | "NO_FORM_INTELLIGENCE_RESULT"
  | "AUTOFILL_PLAN_FAILED"
  | "AUTOFILL_EXECUTION_FAILED";

export interface ExtensionErrorPayload {
  code: ExtensionErrorCode;
  message: string;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ExtensionErrorPayload;
}

const MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "GET_EXTENSION_STATUS",
  "GET_ACTIVE_PROFILE",
  "PING_CONTENT_SCRIPT",
  "GET_PAGE_CONTEXT",
  "EXTRACT_JOB_PAGE",
  "ANALYZE_CURRENT_JOB",
  "GET_MATCH_RESULT",
  "RUN_EMBEDDING_SPIKE",
  "RUN_OFFSCREEN_EMBEDDING_SPIKE",
  "RUN_RETRIEVAL_BENCHMARK",
  "EXTRACT_FORM",
  "ANALYZE_FORM",
  "GET_FORM_INTELLIGENCE",
  "BUILD_AUTOFILL_PLAN",
  "GET_AUTOFILL_PLAN",
  "EXECUTE_AUTOFILL_PLAN",
] satisfies ExtensionMessageType[]);

/** Unknown/malformed messages must fail safely (SDD section 11) rather than being cast blindly. */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" && MESSAGE_TYPES.has(type);
}
