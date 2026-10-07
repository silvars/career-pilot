import { describe, expect, it } from "vitest";
import {
  createInitialState,
  withAutofillExecutionError,
  withAutofillExecutionResult,
  withAutofillExecutionStatus,
  withAutofillPlan,
  withAutofillPlanError,
  withAutofillPlanStatus,
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
import type { AutofillPlan } from "../../src/autofill/types/autofillAction.js";
import type { AutofillResult } from "../../src/autofill/types/autofillResult.js";

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

const INITIAL_AUTOFILL_STATE = {
  planStatus: "idle",
  plan: null,
  planError: null,
  executionStatus: "idle",
  executionResult: null,
  executionError: null,
};

const SAMPLE_PLAN: AutofillPlan = {
  actions: [{ fieldId: "fullName", action: "SET_VALUE", value: "Rodrigo Matos", confidence: 0.9, requiresReview: false }],
  summary: { total: 1, fillable: 1, requiresReview: 0, skipped: 0 },
};

const SAMPLE_EXECUTION_RESULT: AutofillResult = {
  success: true,
  fields: [{ fieldId: "fullName", success: true, expectedValue: "Rodrigo Matos", actualValue: "Rodrigo Matos" }],
  summary: { attempted: 1, filled: 1, failed: 0, skipped: 0 },
};

describe("extension-state", () => {
  it("starts with no profile, no page, not initialized and idle job match/form intelligence/autofill states", () => {
    const state = createInitialState();
    expect(state).toEqual({
      initialized: false,
      activeProfileId: null,
      currentPage: null,
      contentScriptConnected: false,
      jobMatch: { status: "idle", result: null, error: null },
      formIntelligence: { status: "idle", result: null, error: null },
      autofill: INITIAL_AUTOFILL_STATE,
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
      autofill: INITIAL_AUTOFILL_STATE,
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

  it("withAutofillPlanStatus updates only the plan status, immutably", () => {
    const state = withAutofillPlanStatus(createInitialState(), "building");
    expect(state.autofill).toEqual({ ...INITIAL_AUTOFILL_STATE, planStatus: "building" });
  });

  it("withAutofillPlan sets planStatus success, stores the plan and clears any previous plan error", () => {
    const withError = withAutofillPlanError(createInitialState(), {
      code: "NO_FORM_INTELLIGENCE_RESULT",
      message: "analyze first",
    });
    const state = withAutofillPlan(withError, SAMPLE_PLAN);
    expect(state.autofill).toEqual({ ...INITIAL_AUTOFILL_STATE, planStatus: "success", plan: SAMPLE_PLAN });
  });

  it("withAutofillPlanError sets planStatus error, stores the error and clears any previous plan", () => {
    const withPlan = withAutofillPlan(createInitialState(), SAMPLE_PLAN);
    const state = withAutofillPlanError(withPlan, { code: "NO_FORM_INTELLIGENCE_RESULT", message: "analyze first" });
    expect(state.autofill).toEqual({
      ...INITIAL_AUTOFILL_STATE,
      planStatus: "error",
      planError: { code: "NO_FORM_INTELLIGENCE_RESULT", message: "analyze first" },
    });
  });

  it("withAutofillExecutionStatus updates only the execution status, immutably", () => {
    const state = withAutofillExecutionStatus(createInitialState(), "executing");
    expect(state.autofill).toEqual({ ...INITIAL_AUTOFILL_STATE, executionStatus: "executing" });
  });

  it("withAutofillExecutionResult sets executionStatus success, stores the result and clears any previous execution error", () => {
    const withError = withAutofillExecutionError(createInitialState(), {
      code: "AUTOFILL_EXECUTION_FAILED",
      message: "content script unavailable",
    });
    const state = withAutofillExecutionResult(withError, SAMPLE_EXECUTION_RESULT);
    expect(state.autofill).toEqual({
      ...INITIAL_AUTOFILL_STATE,
      executionStatus: "success",
      executionResult: SAMPLE_EXECUTION_RESULT,
    });
  });

  it("withAutofillExecutionError sets executionStatus error, stores the error and clears any previous execution result", () => {
    const withResult = withAutofillExecutionResult(createInitialState(), SAMPLE_EXECUTION_RESULT);
    const state = withAutofillExecutionError(withResult, {
      code: "AUTOFILL_EXECUTION_FAILED",
      message: "content script unavailable",
    });
    expect(state.autofill).toEqual({
      ...INITIAL_AUTOFILL_STATE,
      executionStatus: "error",
      executionError: { code: "AUTOFILL_EXECUTION_FAILED", message: "content script unavailable" },
    });
  });
});
