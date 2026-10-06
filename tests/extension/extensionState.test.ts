import { describe, expect, it } from "vitest";
import {
  createInitialState,
  withInitialized,
  withJobMatchError,
  withJobMatchResult,
  withJobMatchStatus,
  withPageContext,
} from "../../src/extension/state/extension-state.js";
import type { MatchResult } from "../../src/job-match/types.js";

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

describe("extension-state", () => {
  it("starts with no profile, no page, not initialized and an idle job match state", () => {
    const state = createInitialState();
    expect(state).toEqual({
      initialized: false,
      activeProfileId: null,
      currentPage: null,
      contentScriptConnected: false,
      jobMatch: { status: "idle", result: null, error: null },
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
});
