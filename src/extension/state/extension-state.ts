import type { MatchResult } from "../../job-match/types.js";
import type { FormIntelligenceResult } from "../../form-intelligence/types/formIntelligenceResult.js";
import type { ExtensionErrorPayload, PageContext } from "../messaging/messages.js";

export type JobMatchStatus = "idle" | "analyzing" | "success" | "error";

/** FASE 4 analysis state — nested under ExtensionState rather than flattened (decision 1.1). */
export interface JobMatchRuntimeState {
  status: JobMatchStatus;
  result: MatchResult | null;
  error: ExtensionErrorPayload | null;
}

export type FormIntelligenceStatus = "idle" | "analyzing" | "success" | "error";

/** FASE 5 (Form Intelligence) analysis state — same shape/lifecycle as JobMatchRuntimeState. */
export interface FormIntelligenceRuntimeState {
  status: FormIntelligenceStatus;
  result: FormIntelligenceResult | null;
  error: ExtensionErrorPayload | null;
}

/** FASE 3 only needs transient, in-memory state (SDD section 12) — nothing persisted. */
export interface ExtensionState {
  initialized: boolean;
  activeProfileId: string | null;
  currentPage: PageContext | null;
  contentScriptConnected: boolean;
  jobMatch: JobMatchRuntimeState;
  formIntelligence: FormIntelligenceRuntimeState;
}

function createInitialJobMatchState(): JobMatchRuntimeState {
  return { status: "idle", result: null, error: null };
}

function createInitialFormIntelligenceState(): FormIntelligenceRuntimeState {
  return { status: "idle", result: null, error: null };
}

export function createInitialState(): ExtensionState {
  return {
    initialized: false,
    activeProfileId: null,
    currentPage: null,
    contentScriptConnected: false,
    jobMatch: createInitialJobMatchState(),
    formIntelligence: createInitialFormIntelligenceState(),
  };
}

export function withInitialized(state: ExtensionState, activeProfileId: string): ExtensionState {
  return { ...state, initialized: true, activeProfileId };
}

export function withPageContext(state: ExtensionState, page: PageContext | null): ExtensionState {
  return { ...state, currentPage: page, contentScriptConnected: page !== null };
}

export function withJobMatchStatus(state: ExtensionState, status: JobMatchStatus): ExtensionState {
  return { ...state, jobMatch: { ...state.jobMatch, status } };
}

export function withJobMatchResult(state: ExtensionState, result: MatchResult): ExtensionState {
  return { ...state, jobMatch: { status: "success", result, error: null } };
}

export function withJobMatchError(state: ExtensionState, error: ExtensionErrorPayload): ExtensionState {
  return { ...state, jobMatch: { status: "error", result: null, error } };
}

export function withFormIntelligenceStatus(state: ExtensionState, status: FormIntelligenceStatus): ExtensionState {
  return { ...state, formIntelligence: { ...state.formIntelligence, status } };
}

export function withFormIntelligenceResult(state: ExtensionState, result: FormIntelligenceResult): ExtensionState {
  return { ...state, formIntelligence: { status: "success", result, error: null } };
}

export function withFormIntelligenceError(state: ExtensionState, error: ExtensionErrorPayload): ExtensionState {
  return { ...state, formIntelligence: { status: "error", result: null, error } };
}
