import type { ExtensionErrorCode, ExtensionErrorPayload } from "./messaging/messages.js";

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode;

  constructor(code: ExtensionErrorCode, message: string) {
    super(message);
    this.name = "ExtensionError";
    this.code = code;
  }

  toPayload(): ExtensionErrorPayload {
    return { code: this.code, message: this.message };
  }
}

/** Converts any thrown value into a safe, typed error payload (never leaks raw internals to the popup). */
export function toErrorPayload(cause: unknown): ExtensionErrorPayload {
  if (cause instanceof ExtensionError) {
    return cause.toPayload();
  }
  return { code: "INTERNAL_ERROR", message: String(cause) };
}
