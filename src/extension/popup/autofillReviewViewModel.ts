import type { ExtensionResponse } from "../messaging/messages.js";
import type { AutofillAction, AutofillPlan } from "../../autofill/types/autofillAction.js";
import type { AutofillResult } from "../../autofill/types/autofillResult.js";

export interface AutofillReviewRow {
  fieldId: string;
  actionLabel: string;
  valuePreview: string;
  requiresReview: boolean;
  /** SKIP rows have nothing to execute — never shown with a checkbox. */
  selectable: boolean;
  /** requiresReview=false -> checked by default; requiresReview=true -> unchecked by default (SDD "Autofill" FASE 6.3 rules). */
  selectedByDefault: boolean;
}

export interface AutofillPlanViewModel {
  statusLabel: string;
  rows: AutofillReviewRow[];
}

export interface AutofillPlanInput {
  /** True while a BUILD_AUTOFILL_PLAN request is in flight (popup-local UI state). */
  building: boolean;
  plan: ExtensionResponse<AutofillPlan | null> | null;
}

function describeAction(action: AutofillAction): { actionLabel: string; valuePreview: string } {
  switch (action.action) {
    case "SET_VALUE":
      return { actionLabel: "Set value", valuePreview: action.value ?? "" };
    case "SELECT_OPTION":
      return { actionLabel: "Select option", valuePreview: action.optionLabel ?? action.value ?? "" };
    case "CHECK":
      return { actionLabel: "Check", valuePreview: "checked" };
    case "UNCHECK":
      return { actionLabel: "Uncheck", valuePreview: "unchecked" };
    case "SKIP":
      return { actionLabel: "Skipped", valuePreview: action.reason ?? "not safely fillable" };
  }
}

/**
 * Pure function, same philosophy as `formIntelligenceViewModel.ts` (SDD
 * "Autofill" FASE 6.3): read-only presentation of an already-built
 * AutofillPlan — never fills, selects or submits anything itself.
 */
export function buildAutofillPlanViewModel(input: AutofillPlanInput): AutofillPlanViewModel {
  if (input.building) {
    return { statusLabel: "Building autofill plan…", rows: [] };
  }
  if (!input.plan || !input.plan.data) {
    const errorLabel = input.plan && !input.plan.success ? input.plan.error?.message : undefined;
    return {
      statusLabel: errorLabel ? `Error: ${errorLabel}` : 'Click "Build Autofill Plan" to review fillable fields',
      rows: [],
    };
  }

  const plan = input.plan.data;
  const summary = plan.summary;
  const rows: AutofillReviewRow[] = plan.actions.map((action) => {
    const { actionLabel, valuePreview } = describeAction(action);
    const selectable = action.action !== "SKIP";
    return {
      fieldId: action.fieldId,
      actionLabel,
      valuePreview,
      requiresReview: action.requiresReview,
      selectable,
      selectedByDefault: selectable && !action.requiresReview,
    };
  });

  return {
    statusLabel:
      `Plan built — ${summary.fillable} fillable, ${summary.requiresReview} need review, ` +
      `${summary.skipped} skipped (of ${summary.total})`,
    rows,
  };
}

export interface AutofillExecutionViewModel {
  statusLabel: string;
  lines: string[];
}

export interface AutofillExecutionInput {
  /** True while an EXECUTE_AUTOFILL_PLAN request is in flight (popup-local UI state). */
  executing: boolean;
  result: ExtensionResponse<AutofillResult | null> | null;
}

export function buildAutofillExecutionViewModel(input: AutofillExecutionInput): AutofillExecutionViewModel {
  if (input.executing) {
    return { statusLabel: "Filling selected fields…", lines: [] };
  }
  if (!input.result || !input.result.data) {
    const errorLabel = input.result && !input.result.success ? input.result.error?.message : undefined;
    return { statusLabel: errorLabel ? `Error: ${errorLabel}` : "", lines: [] };
  }

  const { summary, fields } = input.result.data;
  return {
    statusLabel: `Fill complete — ${summary.filled} filled, ${summary.failed} failed, ${summary.skipped} skipped`,
    lines: fields.map((field) => `${field.fieldId}: ${field.success ? "PASS" : `FAIL (${field.error})`}`),
  };
}
