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
  | { type: "GET_MATCH_RESULT" };

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
  | "CURRENT_TAB_NOT_AVAILABLE";

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
] satisfies ExtensionMessageType[]);

/** Unknown/malformed messages must fail safely (SDD section 11) rather than being cast blindly. */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" && MESSAGE_TYPES.has(type);
}
