import { describe, expect, it } from "vitest";
import { buildPopupViewModel } from "../../src/extension/popup/popupViewModel.js";
import type { MatchResult } from "../../src/job-match/types.js";

const SAMPLE_RESULT: MatchResult = {
  score: 87,
  recommendation: "GOOD_MATCH",
  matchedRequirements: [
    { requirement: "Java", type: "REQUIRED_SKILL", status: "MATCHED", score: 93, evidence: [] },
    { requirement: "Leadership", type: "RESPONSIBILITY", status: "MATCHED", score: 97, evidence: [] },
  ],
  partialRequirements: [
    { requirement: "Insurance experience", type: "REQUIRED_EXPERIENCE", status: "PARTIAL", score: 50, evidence: [] },
  ],
  missingRequirements: [
    { requirement: "Terraform", type: "REQUIRED_SKILL", status: "MISSING", score: 0, evidence: [] },
  ],
  unclearRequirements: [],
  eligibilityWarnings: [
    {
      type: "AFFIRMATIVE_PROGRAM",
      detectedPhrase: "affirmative opportunity",
      source: "...",
      confidence: "MEDIUM",
      description: "Job description may indicate an affirmative/inclusion opportunity.",
    },
  ],
  evidence: [],
  profileId: "rodrigo-matos",
};

describe("buildPopupViewModel", () => {
  it("renders a healthy state", () => {
    const vm = buildPopupViewModel({
      status: { success: true, data: { initialized: true, activeProfileId: "rodrigo-matos" } },
      profile: { success: true, data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" } },
      pageConnected: true,
      jobMatch: null,
      analyzing: false,
    });

    expect(vm.statusLabel).toBe("Ready");
    expect(vm.profileLabel).toBe("Rodrigo Matos Silva");
    expect(vm.pageLabel).toBe("Connected");
    expect(vm.jobMatchLabel).toBe('Click "Analyze Job" to evaluate this page');
  });

  it("renders missing/null responses as Unknown", () => {
    const vm = buildPopupViewModel({ status: null, profile: null, pageConnected: false, jobMatch: null, analyzing: false });
    expect(vm.statusLabel).toBe("Unknown");
    expect(vm.profileLabel).toBe("Unknown");
    expect(vm.pageLabel).toBe("Unavailable on this page");
  });

  it("renders a PROFILE_NOT_LOADED error as 'Not loaded'", () => {
    const vm = buildPopupViewModel({
      status: { success: true, data: { initialized: false, activeProfileId: null } },
      profile: { success: false, error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." } },
      pageConnected: false,
      jobMatch: null,
      analyzing: false,
    });

    expect(vm.profileLabel).toBe("Not loaded");
  });

  it("renders an extension status error with its message", () => {
    const vm = buildPopupViewModel({
      status: { success: false, error: { code: "EXTENSION_INITIALIZATION_FAILED", message: "profile.json missing" } },
      profile: null,
      pageConnected: false,
      jobMatch: null,
      analyzing: false,
    });

    expect(vm.statusLabel).toBe("Error: profile.json missing");
  });

  it("renders an unavailable content script as 'Unavailable on this page'", () => {
    const vm = buildPopupViewModel({ status: null, profile: null, pageConnected: false, jobMatch: null, analyzing: false });
    expect(vm.pageLabel).toBe("Unavailable on this page");
  });

  describe("Job Match result rendering", () => {
    it("shows 'Analyzing…' while a request is in flight, regardless of stale jobMatch data", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: { success: true, data: SAMPLE_RESULT },
        analyzing: true,
      });
      expect(vm.jobMatchLabel).toBe("Analyzing…");
    });

    it("shows the idle prompt when no analysis has run yet (data: null)", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: { success: true, data: null },
        analyzing: false,
      });
      expect(vm.jobMatchLabel).toBe('Click "Analyze Job" to evaluate this page');
      expect(vm.jobMatchDetails).toEqual([]);
    });

    it("renders score, recommendation and a breakdown of matched/partial/missing/eligibility", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: { success: true, data: SAMPLE_RESULT },
        analyzing: false,
      });

      expect(vm.jobMatchLabel).toBe("87 / 100 — Good Match");
      expect(vm.jobMatchDetails).toEqual([
        "✓ Matched: Java, Leadership",
        "△ Partial: Insurance experience",
        "✕ Missing (required): Terraform",
        "⚠ Eligibility: 1 warning(s) — review separately",
      ]);
    });

    it("omits the eligibility line entirely when there are no warnings", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: { success: true, data: { ...SAMPLE_RESULT, eligibilityWarnings: [] } },
        analyzing: false,
      });

      expect(vm.jobMatchDetails.some((line) => line.includes("Eligibility"))).toBe(false);
    });

    it("renders an analysis error (e.g. NO_JOB_CONTENT) with its message", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: {
          success: false,
          error: { code: "NO_JOB_CONTENT", message: "The current page does not appear to contain job content." },
        },
        analyzing: false,
      });

      expect(vm.jobMatchLabel).toBe("Error: The current page does not appear to contain job content.");
    });

    it("dedupes matched requirements that share the same label (e.g. TITLE and SENIORITY both 'Engineering Manager')", () => {
      const vm = buildPopupViewModel({
        status: null,
        profile: null,
        pageConnected: true,
        jobMatch: {
          success: true,
          data: {
            ...SAMPLE_RESULT,
            matchedRequirements: [
              { requirement: "Engineering Manager", type: "TITLE", status: "MATCHED", score: 95, evidence: [] },
              { requirement: "Engineering Manager", type: "SENIORITY", status: "MATCHED", score: 95, evidence: [] },
            ],
          },
        },
        analyzing: false,
      });

      expect(vm.jobMatchDetails[0]).toBe("✓ Matched: Engineering Manager");
    });
  });
});
