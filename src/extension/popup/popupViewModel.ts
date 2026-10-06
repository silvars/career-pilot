import type { ExtensionResponse } from "../messaging/messages.js";

export interface PopupViewModel {
  statusLabel: string;
  profileLabel: string;
  pageLabel: string;
  jobMatchLabel: string;
}

export interface PopupInput {
  status: ExtensionResponse | null;
  profile: ExtensionResponse | null;
  pageConnected: boolean;
}

const JOB_MATCH_LABEL = "Available in next phase";

/**
 * Pure function: maps raw message responses to display strings. Testable
 * without a real DOM (SDD section 18.3 / decision 1.1) — `popup.ts` is the
 * thin, untested entry point that wires this to actual elements.
 */
export function buildPopupViewModel(input: PopupInput): PopupViewModel {
  const statusLabel = !input.status
    ? "Unknown"
    : input.status.success
      ? "Ready"
      : `Error: ${input.status.error?.message ?? input.status.error?.code ?? "unknown"}`;

  const profileLabel = !input.profile
    ? "Unknown"
    : input.profile.success
      ? String((input.profile.data as { name?: string } | undefined)?.name ?? "Unnamed profile")
      : "Not loaded";

  const pageLabel = input.pageConnected ? "Connected" : "Unavailable on this page";

  return { statusLabel, profileLabel, pageLabel, jobMatchLabel: JOB_MATCH_LABEL };
}
