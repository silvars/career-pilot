import { JobMatchError } from "../job-match/errors.js";
import { ProfileError } from "../profile/errors.js";
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

/** Maps a domain-level JobMatchError code to the richer extension-facing vocabulary (FASE 4 SDD section 33). */
function fromJobMatchError(cause: JobMatchError): ExtensionErrorPayload {
  switch (cause.code) {
    case "JOB_PAGE_NOT_READABLE":
      return { code: "PAGE_EXTRACTION_FAILED", message: cause.message };
    case "JOB_REQUIREMENTS_NOT_FOUND":
      return { code: "NO_JOB_CONTENT", message: cause.message };
    case "JOB_ANALYSIS_FAILED":
      return { code: "JOB_ANALYSIS_FAILED", message: cause.message };
    case "MATCH_ANALYSIS_FAILED":
      return { code: "MATCH_ANALYSIS_FAILED", message: cause.message };
    case "NO_RELEVANT_PROFILE_CONTEXT":
      return { code: "PROFILE_CONTEXT_NOT_FOUND", message: cause.message };
  }
}

/** Converts any thrown value into a safe, typed error payload (never leaks raw internals to the popup). */
export function toErrorPayload(cause: unknown): ExtensionErrorPayload {
  if (cause instanceof ExtensionError) {
    return cause.toPayload();
  }
  if (cause instanceof JobMatchError) {
    return fromJobMatchError(cause);
  }
  if (cause instanceof ProfileError) {
    return { code: "PROFILE_LOAD_FAILED", message: cause.message };
  }
  return { code: "INTERNAL_ERROR", message: String(cause) };
}
