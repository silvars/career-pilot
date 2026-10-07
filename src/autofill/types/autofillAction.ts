/**
 * One proposed DOM action for a single field (SDD "Autofill" section 4.1).
 * `SKIP` always carries a `reason` for traceability — no silent SKIPs.
 */
export type AutofillActionType = "SET_VALUE" | "SELECT_OPTION" | "CHECK" | "UNCHECK" | "SKIP";

export interface AutofillAction {
  fieldId: string;
  action: AutofillActionType;
  value?: string;
  optionLabel?: string;
  confidence: number;
  requiresReview: boolean;
  reason?: string;
}

export interface AutofillPlanSummary {
  total: number;
  fillable: number;
  requiresReview: number;
  skipped: number;
}

export interface AutofillPlan {
  formId?: string;
  actions: AutofillAction[];
  summary: AutofillPlanSummary;
}
