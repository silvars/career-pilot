import { describe, expect, it } from "vitest";
import {
  createInitialState,
  withFormIntelligenceError,
  withFormIntelligenceResult,
  withFormIntelligenceStatus,
  withInitialized,
  withJobMatchError,
  withJobMatchResult,
  withJobMatchStatus,
  withPageContext,
} from "../../src/extension/state/extension-state.js";
import type { MatchResult } from "../../src/job-match/types.js";
import type { FormIntelligenceResult } from "../../src/form-intelligence/types/formIntelligenceResult.js";

const SAMPLE_RESULT: MatchResult = {
  score: 80,
  recommendation: "GOOD_MATCH",
  matchedRequirements: [],
  partialRequirements: [],
  missingRequirements: [],
  unclearRequirements: [],
  eligibilityWarnings: [],
  evidence: [],
  profileId: "rodrigo-matos",
};

const SAMPLE_FORM_RESULT: FormIntelligenceResult = {
  url: "https://example.com/apply",
  fields: [],
  intents: [],
  answers: [],
  summary: {
    totalFields: 0,
    understoodFields: 0,
    answerableFields: 0,
    requiresUserInput: 0,
    requiresReview: 0,
    unknownFields: 0,
  },
};

describe("extension-state", () => {
  it("starts with no profile, no page, not initialized and idle job match/form intelligence states", () => {
    const state = createInitialState();
    expect(state).toEqual({
      initialized: false,
      activeProfileId: null,
      currentPage: null,
      contentScriptConnected: false,
      jobMatch: { status: "idle", result: null, error: null },
      formIntelligence: { status: "idle", result: null, error: null },
    });
  });

  it("withInitialized marks the state initialized with the given profile id, immutably", () => {
    const before = createInitialState();
    const after = withInitialized(before, "rodrigo-matos");

    expect(after).toEqual({
      initialized: true,
      activeProfileId: "rodrigo-matos",
      currentPage: null,
      contentScriptConnected: false,
      jobMatch: { status: "idle", result: null, error: null },
      formIntelligence: { status: "idle", result: null, error: null },
    });
    expect(before.initialized).toBe(false); // original untouched
  });

  it("withPageContext marks the content script as connected when a page is provided", () => {
    const state = withPageContext(createInitialState(), { url: "https://example.com", title: "Example" });
    expect(state.contentScriptConnected).toBe(true);
    expect(state.currentPage).toEqual({ url: "https://example.com", title: "Example" });
  });

  it("withPageContext(null) marks the content script as disconnected", () => {
    const connected = withPageContext(createInitialState(), { url: "https://example.com", title: "Example" });
    const disconnected = withPageContext(connected, null);
    expect(disconnected.contentScriptConnected).toBe(false);
    expect(disconnected.currentPage).toBeNull();
  });

  it("withJobMatchStatus updates only the status, immutably", () => {
    const state = withJobMatchStatus(createInitialState(), "analyzing");
    expect(state.jobMatch).toEqual({ status: "analyzing", result: null, error: null });
  });

  it("withJobMatchResult sets status success, stores the result and clears any previous error", () => {
    const withError = withJobMatchError(createInitialState(), { code: "NO_JOB_CONTENT", message: "no content" });
    const state = withJobMatchResult(withError, SAMPLE_RESULT);
    expect(state.jobMatch).toEqual({ status: "success", result: SAMPLE_RESULT, error: null });
  });

  it("withJobMatchError sets status error, stores the error and clears any previous result", () => {
    const withResult = withJobMatchResult(createInitialState(), SAMPLE_RESULT);
    const state = withJobMatchError(withResult, { code: "NO_JOB_CONTENT", message: "no content" });
    expect(state.jobMatch).toEqual({
      status: "error",
      result: null,
      error: { code: "NO_JOB_CONTENT", message: "no content" },
    });
  });

  it("withFormIntelligenceStatus updates only the status, immutably", () => {
    const state = withFormIntelligenceStatus(createInitialState(), "analyzing");
    expect(state.formIntelligence).toEqual({ status: "analyzing", result: null, error: null });
  });

  it("withFormIntelligenceResult sets status success, stores the result and clears any previous error", () => {
    const withError = withFormIntelligenceError(createInitialState(), { code: "NO_JOB_CONTENT", message: "no content" });
    const state = withFormIntelligenceResult(withError, SAMPLE_FORM_RESULT);
    expect(state.formIntelligence).toEqual({ status: "success", result: SAMPLE_FORM_RESULT, error: null });
  });

  it("withFormIntelligenceError sets status error, stores the error and clears any previous result", () => {
    const withResult = withFormIntelligenceResult(createInitialState(), SAMPLE_FORM_RESULT);
    const state = withFormIntelligenceError(withResult, { code: "NO_JOB_CONTENT", message: "no content" });
    expect(state.formIntelligence).toEqual({
      status: "error",
      result: null,
      error: { code: "NO_JOB_CONTENT", message: "no content" },
    });
  });
});
