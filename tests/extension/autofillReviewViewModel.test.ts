import { describe, expect, it } from "vitest";
import { buildAutofillExecutionViewModel, buildAutofillPlanViewModel } from "../../src/extension/popup/autofillReviewViewModel.js";
import type { AutofillPlan } from "../../src/autofill/types/autofillAction.js";
import type { AutofillResult } from "../../src/autofill/types/autofillResult.js";

const SAMPLE_PLAN: AutofillPlan = {
  actions: [
    { fieldId: "fullName", action: "SET_VALUE", value: "Rodrigo Matos", confidence: 0.95, requiresReview: false },
    { fieldId: "salary", action: "SET_VALUE", value: "USD 180k", confidence: 0.6, requiresReview: true },
    { fieldId: "seniority", action: "SELECT_OPTION", optionLabel: "Senior", value: "senior", confidence: 0.9, requiresReview: false },
    { fieldId: "gender", action: "SKIP", confidence: 0, requiresReview: false, reason: "blocked semantic type: PROTECTED_OR_LEGAL" },
  ],
  summary: { total: 4, fillable: 3, requiresReview: 1, skipped: 1 },
};

describe("buildAutofillPlanViewModel", () => {
  it("reports a 'building' status with no rows while BUILD_AUTOFILL_PLAN is in flight", () => {
    const vm = buildAutofillPlanViewModel({ building: true, plan: null });
    expect(vm.statusLabel).toBe("Building autofill plan…");
    expect(vm.rows).toEqual([]);
  });

  it("prompts to build a plan when none exists yet", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: null });
    expect(vm.statusLabel).toContain("Build Autofill Plan");
    expect(vm.rows).toEqual([]);
  });

  it("surfaces the error message when BUILD_AUTOFILL_PLAN failed", () => {
    const vm = buildAutofillPlanViewModel({
      building: false,
      plan: { success: false, error: { code: "NO_FORM_INTELLIGENCE_RESULT", message: "Analyze the form first." } },
    });
    expect(vm.statusLabel).toBe("Error: Analyze the form first.");
  });

  it("marks requiresReview=false fillable actions as selected by default", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: { success: true, data: SAMPLE_PLAN } });
    const fullName = vm.rows.find((row) => row.fieldId === "fullName");
    expect(fullName).toMatchObject({ selectable: true, selectedByDefault: true, requiresReview: false });
  });

  it("marks requiresReview=true fillable actions as unselected by default", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: { success: true, data: SAMPLE_PLAN } });
    const salary = vm.rows.find((row) => row.fieldId === "salary");
    expect(salary).toMatchObject({ selectable: true, selectedByDefault: false, requiresReview: true });
  });

  it("marks SKIP actions as non-selectable, regardless of requiresReview", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: { success: true, data: SAMPLE_PLAN } });
    const gender = vm.rows.find((row) => row.fieldId === "gender");
    expect(gender).toMatchObject({ selectable: false, selectedByDefault: false });
    expect(gender?.valuePreview).toContain("PROTECTED_OR_LEGAL");
  });

  it("describes a SELECT_OPTION action using the option label", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: { success: true, data: SAMPLE_PLAN } });
    const seniority = vm.rows.find((row) => row.fieldId === "seniority");
    expect(seniority).toMatchObject({ actionLabel: "Select option", valuePreview: "Senior" });
  });

  it("summarizes fillable/requiresReview/skipped counts from the plan summary", () => {
    const vm = buildAutofillPlanViewModel({ building: false, plan: { success: true, data: SAMPLE_PLAN } });
    expect(vm.statusLabel).toBe("Plan built — 3 fillable, 1 need review, 1 skipped (of 4)");
  });
});

const SAMPLE_RESULT: AutofillResult = {
  success: false,
  fields: [
    { fieldId: "fullName", success: true, expectedValue: "Rodrigo Matos", actualValue: "Rodrigo Matos" },
    { fieldId: "seniority", success: false, error: "no matching <option> found in the DOM" },
  ],
  summary: { attempted: 2, filled: 1, failed: 1, skipped: 2 },
};

describe("buildAutofillExecutionViewModel", () => {
  it("reports an 'executing' status with no lines while EXECUTE_AUTOFILL_PLAN is in flight", () => {
    const vm = buildAutofillExecutionViewModel({ executing: true, result: null });
    expect(vm.statusLabel).toBe("Filling selected fields…");
    expect(vm.lines).toEqual([]);
  });

  it("renders PASS/FAIL per field and the overall summary once execution completes", () => {
    const vm = buildAutofillExecutionViewModel({ executing: false, result: { success: true, data: SAMPLE_RESULT } });
    expect(vm.statusLabel).toBe("Fill complete — 1 filled, 1 failed, 2 skipped");
    expect(vm.lines).toEqual([
      "fullName: PASS",
      "seniority: FAIL (no matching <option> found in the DOM)",
    ]);
  });

  it("shows nothing before any execution has happened", () => {
    const vm = buildAutofillExecutionViewModel({ executing: false, result: null });
    expect(vm.statusLabel).toBe("");
    expect(vm.lines).toEqual([]);
  });
});
