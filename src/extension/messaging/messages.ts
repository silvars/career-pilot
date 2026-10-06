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
  | { type: "GET_PAGE_CONTEXT" };

export type ExtensionMessageType = ExtensionMessage["type"];

export type ExtensionErrorCode =
  | "EXTENSION_INITIALIZATION_FAILED"
  | "INVALID_MESSAGE"
  | "CONTENT_SCRIPT_UNAVAILABLE"
  | "PROFILE_NOT_LOADED"
  | "PROFILE_LOAD_FAILED"
  | "PAGE_CONTEXT_UNAVAILABLE"
  | "INTERNAL_ERROR";

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
] satisfies ExtensionMessageType[]);

/** Unknown/malformed messages must fail safely (SDD section 11) rather than being cast blindly. */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" && MESSAGE_TYPES.has(type);
}
