import type { PageContext } from "../messaging/messages.js";

/** FASE 3 only needs transient, in-memory state (SDD section 12) — nothing persisted. */
export interface ExtensionState {
  initialized: boolean;
  activeProfileId: string | null;
  currentPage: PageContext | null;
  contentScriptConnected: boolean;
}

export function createInitialState(): ExtensionState {
  return {
    initialized: false,
    activeProfileId: null,
    currentPage: null,
    contentScriptConnected: false,
  };
}

export function withInitialized(state: ExtensionState, activeProfileId: string): ExtensionState {
  return { ...state, initialized: true, activeProfileId };
}

export function withPageContext(state: ExtensionState, page: PageContext | null): ExtensionState {
  return { ...state, currentPage: page, contentScriptConnected: page !== null };
}
