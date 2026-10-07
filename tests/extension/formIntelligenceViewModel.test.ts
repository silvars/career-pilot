import { describe, expect, it } from "vitest";
import { buildFormIntelligenceViewModel } from "../../src/extension/popup/formIntelligenceViewModel.js";
import type { FormIntelligenceResult } from "../../src/form-intelligence/types/formIntelligenceResult.js";

function field(id: string, label: string) {
  return { id, elementType: "TEXT" as const, label, required: false, source: "LABEL" as const };
}

const SAMPLE_RESULT: FormIntelligenceResult = {
  url: "https://example.com/apply",
  fields: [field("email", "Email"), field("salary", "Expected salary"), field("mystery", "")],
  intents: [
    {
      fieldId: "email",
      semanticType: "CONTACT",
      normalizedQuestion: "Email",
      confidence: 0.95,
      evidence: ["label: matched \"email\""],
      answerStrategy: "PROFILE_VALUE",
    },
    {
      fieldId: "salary",
      semanticType: "SALARY_EXPECTATION",
      normalizedQuestion: "Expected salary",
      confidence: 0.95,
      evidence: ["label: matched \"salary\""],
      answerStrategy: "USER_INPUT_REQUIRED",
    },
    {
      fieldId: "mystery",
      semanticType: "UNKNOWN",
      normalizedQuestion: "",
      confidence: 0,
      evidence: [],
      answerStrategy: "DO_NOT_ANSWER",
    },
  ],
  answers: [
    {
      fieldId: "email",
      value: "silvars@gmail.com",
      confidence: 0.9,
      source: "PROFILE",
      evidence: [],
      requiresReview: false,
    },
    { fieldId: "salary", confidence: 0, source: "USER_REQUIRED", evidence: [], requiresReview: true },
    { fieldId: "mystery", confidence: 0, source: "NONE", evidence: [], requiresReview: false },
  ],
  summary: {
    totalFields: 3,
    understoodFields: 2,
    answerableFields: 1,
    requiresUserInput: 1,
    requiresReview: 1,
    unknownFields: 1,
  },
};

describe("buildFormIntelligenceViewModel", () => {
  it("shows a prompt before any analysis has run", () => {
    const vm = buildFormIntelligenceViewModel({ analyzing: false, result: null });
    expect(vm.statusLabel).toContain("Analyze Form");
    expect(vm.rows).toEqual([]);
  });

  it("shows an analyzing state", () => {
    const vm = buildFormIntelligenceViewModel({ analyzing: true, result: null });
    expect(vm.statusLabel).toBe("Analyzing form…");
  });

  it("shows an error state", () => {
    const vm = buildFormIntelligenceViewModel({
      analyzing: false,
      result: { success: false, error: { code: "NO_FORM_CONTENT", message: "No form fields found." } },
    });
    expect(vm.statusLabel).toBe("Error: No form fields found.");
  });

  it("renders the summary and one row per field, joining intent + answer by fieldId", () => {
    const vm = buildFormIntelligenceViewModel({ analyzing: false, result: { success: true, data: SAMPLE_RESULT } });

    expect(vm.statusLabel).toBe("Form detected — 3 field(s)");
    expect(vm.summaryLabel).toBe("2 understood · 1 answerable · 1 need your input · 1 need review");
    expect(vm.rows).toHaveLength(3);

    expect(vm.rows[0]).toEqual({
      fieldLabel: "Email",
      semanticType: "CONTACT",
      answerPreview: "silvars@gmail.com",
      confidence: 0.9,
      source: "PROFILE",
      requiresReview: false,
    });

    expect(vm.rows[1]).toMatchObject({
      fieldLabel: "Expected salary",
      semanticType: "SALARY_EXPECTATION",
      answerPreview: "Your input required",
      source: "USER_REQUIRED",
      requiresReview: true,
    });

    expect(vm.rows[2]).toMatchObject({ semanticType: "UNKNOWN", answerPreview: "Not recognized", source: "NONE" });
  });

  it("falls back to placeholder/name/id when a field has no label", () => {
    const result: FormIntelligenceResult = {
      ...SAMPLE_RESULT,
      fields: [{ id: "f1", elementType: "TEXT", placeholder: "Your city", required: false, source: "PLACEHOLDER" }],
      intents: [],
      answers: [],
      summary: { totalFields: 1, understoodFields: 0, answerableFields: 0, requiresUserInput: 0, requiresReview: 0, unknownFields: 1 },
    };
    const vm = buildFormIntelligenceViewModel({ analyzing: false, result: { success: true, data: result } });
    expect(vm.rows[0].fieldLabel).toBe("Your city");
  });
});
