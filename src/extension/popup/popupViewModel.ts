import type { ExtensionResponse } from "../messaging/messages.js";
import type { MatchRequirement, MatchResult } from "../../job-match/types.js";

export interface PopupViewModel {
  statusLabel: string;
  profileLabel: string;
  pageLabel: string;
  jobMatchLabel: string;
  jobMatchDetails: string[];
}

export interface PopupInput {
  status: ExtensionResponse | null;
  profile: ExtensionResponse | null;
  pageConnected: boolean;
  /** Result of ANALYZE_CURRENT_JOB or GET_MATCH_RESULT; `data` is null when nothing has been analyzed yet. */
  jobMatch: ExtensionResponse<MatchResult | null> | null;
  /** True while an ANALYZE_CURRENT_JOB request is in flight (popup-local UI state). */
  analyzing: boolean;
}

const RECOMMENDATION_LABELS: Record<MatchResult["recommendation"], string> = {
  STRONG_MATCH: "Strong Match",
  GOOD_MATCH: "Good Match",
  PARTIAL_MATCH: "Partial Match",
  LOW_MATCH: "Low Match",
};

function listRequirementNames(requirements: MatchRequirement[], limit = 5): string {
  if (requirements.length === 0) {
    return "none";
  }
  // TITLE and SENIORITY are distinct requirement types that legitimately
  // coincide in text (e.g. a job titled "Engineering Manager" also matches
  // the seniority dictionary entry "Engineering Manager") — dedupe by label
  // so the summary doesn't show the same name twice.
  const names = [...new Set(requirements.map((r) => r.requirement))];
  const suffix = names.length > limit ? `, +${names.length - limit} more` : "";
  return names.slice(0, limit).join(", ") + suffix;
}

function buildJobMatchDetails(result: MatchResult): string[] {
  const requiredMissing = result.missingRequirements.filter(
    (r) => r.type === "REQUIRED_SKILL" || r.type === "REQUIRED_EXPERIENCE"
  );

  const details = [
    `✓ Matched: ${listRequirementNames(result.matchedRequirements)}`,
    `△ Partial: ${listRequirementNames(result.partialRequirements)}`,
    `✕ Missing (required): ${listRequirementNames(requiredMissing)}`,
  ];

  if (result.eligibilityWarnings.length > 0) {
    details.push(`⚠ Eligibility: ${result.eligibilityWarnings.length} warning(s) — review separately`);
  }

  return details;
}

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

  let jobMatchLabel: string;
  let jobMatchDetails: string[] = [];

  if (input.analyzing) {
    jobMatchLabel = "Analyzing…";
  } else if (!input.jobMatch) {
    jobMatchLabel = 'Click "Analyze Job" to evaluate this page';
  } else if (!input.jobMatch.success) {
    jobMatchLabel = `Error: ${input.jobMatch.error?.message ?? input.jobMatch.error?.code ?? "unknown"}`;
  } else if (!input.jobMatch.data) {
    jobMatchLabel = 'Click "Analyze Job" to evaluate this page';
  } else {
    const result = input.jobMatch.data;
    jobMatchLabel = `${result.score} / 100 — ${RECOMMENDATION_LABELS[result.recommendation]}`;
    jobMatchDetails = buildJobMatchDetails(result);
  }

  return { statusLabel, profileLabel, pageLabel, jobMatchLabel, jobMatchDetails };
}
