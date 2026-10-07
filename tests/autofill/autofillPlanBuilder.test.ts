import { describe, expect, it } from "vitest";
import { buildAutofillPlan } from "../../src/autofill/plan/autofillPlanBuilder.js";
import type { FormField } from "../../src/form-intelligence/types/formField.js";
import type { FieldIntent } from "../../src/form-intelligence/types/fieldIntent.js";
import type { FieldAnswer } from "../../src/form-intelligence/types/fieldAnswer.js";

function field(overrides: Partial<FormField>): FormField {
  return { id: "f1", elementType: "TEXT", required: false, source: "LABEL", ...overrides };
}

function intent(overrides: Partial<FieldIntent>): FieldIntent {
  return {
    fieldId: "f1",
    semanticType: "CUSTOM_QUESTION",
    normalizedQuestion: "question",
    confidence: 0.5,
    evidence: [],
    answerStrategy: "PROFILE_RETRIEVAL",
    ...overrides,
  };
}

function answer(overrides: Partial<FieldAnswer>): FieldAnswer {
  return { fieldId: "f1", confidence: 0.5, source: "PROFILE", evidence: [], requiresReview: false, ...overrides };
}

describe("buildAutofillPlan — SELECT", () => {
  it("SELECT with an answer that doesn't exist among the options -> SKIP", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "SELECT", options: [{ value: "jr", label: "Junior" }] })],
      [intent({})],
      [answer({ value: "Staff" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SKIP", reason: "no safe option match" });
  });

  it("SELECT with an exact value match -> SELECT_OPTION (allowed)", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "SELECT", options: [{ value: "jr", label: "Junior" }, { value: "sr", label: "Senior" }] })],
      [intent({})],
      [answer({ value: "sr" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SELECT_OPTION", optionLabel: "Senior", value: "sr" });
  });

  it("SELECT with a safe label match -> SELECT_OPTION (allowed)", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "SELECT", options: [{ value: "jr", label: "Junior" }, { value: "sr", label: "Senior" }] })],
      [intent({})],
      [answer({ value: "Senior" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SELECT_OPTION", optionLabel: "Senior" });
  });
});

describe("buildAutofillPlan — RADIO", () => {
  it("RADIO with a non-existent option -> SKIP", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "RADIO", options: [{ value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }] })],
      [intent({})],
      [answer({ value: "On-site" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SKIP" });
  });

  it("RADIO with an existing option -> SELECT_OPTION (allowed)", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "RADIO", options: [{ value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }] })],
      [intent({})],
      [answer({ value: "Remote" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SELECT_OPTION", optionLabel: "Remote", value: "remote" });
  });
});

describe("buildAutofillPlan — CHECKBOX", () => {
  it("CHECKBOX without explicit intent -> SKIP", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "CHECKBOX" })],
      [intent({})],
      [answer({ value: "I agree to the terms of this very long sentence" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SKIP", reason: "no explicit checkbox intent" });
  });

  it("CHECKBOX with explicit intent -> CHECK", () => {
    const plan = buildAutofillPlan([field({ elementType: "CHECKBOX" })], [intent({})], [answer({ value: "yes" })]);
    expect(plan.actions[0]).toMatchObject({ action: "CHECK" });
  });

  it("CHECKBOX with explicit negative intent -> UNCHECK", () => {
    const plan = buildAutofillPlan([field({ elementType: "CHECKBOX" })], [intent({})], [answer({ value: "no" })]);
    expect(plan.actions[0]).toMatchObject({ action: "UNCHECK" });
  });
});

describe("buildAutofillPlan — TEXT/TEXTAREA", () => {
  it("TEXT -> SET_VALUE", () => {
    const plan = buildAutofillPlan([field({ elementType: "TEXT" })], [intent({})], [answer({ value: "Rodrigo" })]);
    expect(plan.actions[0]).toMatchObject({ action: "SET_VALUE", value: "Rodrigo" });
  });

  it("TEXTAREA -> SET_VALUE", () => {
    const plan = buildAutofillPlan([field({ elementType: "TEXTAREA" })], [intent({})], [answer({ value: "A long answer." })]);
    expect(plan.actions[0]).toMatchObject({ action: "SET_VALUE", value: "A long answer." });
  });
});

describe("buildAutofillPlan — COMBOBOX", () => {
  it("combobox without known options -> SKIP (never guessed)", () => {
    const plan = buildAutofillPlan([field({ elementType: "COMBOBOX" })], [intent({})], [answer({ value: "Brazil" })]);
    expect(plan.actions[0]).toMatchObject({ action: "SKIP" });
  });

  it("combobox backed by known options, safe match -> SELECT_OPTION", () => {
    const plan = buildAutofillPlan(
      [field({ elementType: "COMBOBOX", options: [{ value: "br", label: "Brazil" }] })],
      [intent({})],
      [answer({ value: "Brazil" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SELECT_OPTION", optionLabel: "Brazil" });
  });
});

describe("buildAutofillPlan — never auto-fills regardless of FieldAnswer.source", () => {
  it("USER_REQUIRED -> SKIP", () => {
    const plan = buildAutofillPlan([field({})], [intent({})], [answer({ source: "USER_REQUIRED", value: undefined })]);
    expect(plan.actions[0]).toMatchObject({ action: "SKIP", reason: "source is USER_REQUIRED" });
  });

  it("NONE -> SKIP", () => {
    const plan = buildAutofillPlan([field({})], [intent({})], [answer({ source: "NONE", value: undefined })]);
    expect(plan.actions[0]).toMatchObject({ action: "SKIP", reason: "source is NONE" });
  });

  it("UNKNOWN semanticType -> SKIP even if an answer carries a value (defense in depth)", () => {
    const plan = buildAutofillPlan(
      [field({})],
      [intent({ semanticType: "UNKNOWN" })],
      [answer({ value: "should never be used" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SKIP" });
  });

  it("protected/legal fields -> SKIP even if an answer carries a value (defense in depth)", () => {
    const plan = buildAutofillPlan(
      [field({})],
      [intent({ semanticType: "PROTECTED_OR_LEGAL" })],
      [answer({ value: "should never be used" })]
    );
    expect(plan.actions[0]).toMatchObject({ action: "SKIP" });
  });

  it("no answer at all -> SKIP", () => {
    const plan = buildAutofillPlan([field({})], [intent({})], []);
    expect(plan.actions[0]).toMatchObject({ action: "SKIP", reason: "no answer value" });
  });
});

describe("buildAutofillPlan — requiresReview preserved and summary correct", () => {
  it("preserves requiresReview on every action regardless of outcome", () => {
    const plan = buildAutofillPlan(
      [field({ id: "a" }), field({ id: "b", elementType: "SELECT", options: [{ value: "x", label: "X" }] })],
      [intent({ fieldId: "a" }), intent({ fieldId: "b" })],
      [
        answer({ fieldId: "a", value: "hi", requiresReview: true }),
        answer({ fieldId: "b", value: "nope", requiresReview: true }),
      ]
    );
    expect(plan.actions[0].requiresReview).toBe(true);
    expect(plan.actions[1].requiresReview).toBe(true); // SKIP, but review flag still preserved
  });

  it("computes total/fillable/requiresReview/skipped correctly", () => {
    const plan = buildAutofillPlan(
      [field({ id: "a" }), field({ id: "b" }), field({ id: "c" })],
      [intent({ fieldId: "a" }), intent({ fieldId: "b" }), intent({ fieldId: "c" })],
      [
        answer({ fieldId: "a", value: "hi", requiresReview: false }),
        answer({ fieldId: "b", source: "USER_REQUIRED", value: undefined, requiresReview: true }),
        answer({ fieldId: "c", value: "ho", requiresReview: true }),
      ]
    );
    expect(plan.summary).toEqual({ total: 3, fillable: 2, requiresReview: 2, skipped: 1 });
  });
});
