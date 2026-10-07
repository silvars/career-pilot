import type { ExtensionResponse } from "../messaging/messages.js";
import type { FormIntelligenceResult } from "../../form-intelligence/types/formIntelligenceResult.js";

export interface FormFieldRow {
  fieldLabel: string;
  semanticType: string;
  answerPreview: string;
  confidence: number;
  source: string;
  requiresReview: boolean;
}

export interface FormIntelligenceViewModel {
  statusLabel: string;
  summaryLabel: string;
  rows: FormFieldRow[];
}

export interface FormIntelligenceInput {
  /** True while an ANALYZE_FORM request is in flight (popup-local UI state). */
  analyzing: boolean;
  /** Result of ANALYZE_FORM or GET_FORM_INTELLIGENCE; `data` is null when nothing has been analyzed yet. */
  result: ExtensionResponse<FormIntelligenceResult | null> | null;
}

function answerPreview(value: string | string[] | undefined, source: string): string {
  if (value !== undefined) {
    return Array.isArray(value) ? value.join(", ") : value.length > 120 ? value.slice(0, 120) + "…" : value;
  }
  if (source === "USER_REQUIRED") {
    return "Your input required";
  }
  return "Not recognized";
}

/**
 * Pure function, same philosophy as `popupViewModel.ts` (SDD "Form
 * Intelligence" section 10) — read-only presentation of the already-built
 * `FormIntelligenceResult`; never fills, selects or submits anything.
 */
export function buildFormIntelligenceViewModel(input: FormIntelligenceInput): FormIntelligenceViewModel {
  if (input.analyzing) {
    return { statusLabel: "Analyzing form…", summaryLabel: "", rows: [] };
  }
  if (!input.result || !input.result.data) {
    const errorLabel = input.result && !input.result.success ? input.result.error?.message : undefined;
    return {
      statusLabel: errorLabel ? `Error: ${errorLabel}` : 'Click "Analyze Form" to detect fields on this page',
      summaryLabel: "",
      rows: [],
    };
  }

  const { fields, intents, answers, summary } = input.result.data;
  const intentByFieldId = new Map(intents.map((intent) => [intent.fieldId, intent]));
  const answerByFieldId = new Map(answers.map((answer) => [answer.fieldId, answer]));

  const rows: FormFieldRow[] = fields.map((field) => {
    const intent = intentByFieldId.get(field.id);
    const answer = answerByFieldId.get(field.id);
    return {
      fieldLabel: field.label ?? field.placeholder ?? field.name ?? field.id,
      semanticType: intent?.semanticType ?? "UNKNOWN",
      answerPreview: answerPreview(answer?.value, answer?.source ?? "NONE"),
      confidence: answer?.confidence ?? 0,
      source: answer?.source ?? "NONE",
      requiresReview: answer?.requiresReview ?? false,
    };
  });

  return {
    statusLabel: `Form detected — ${summary.totalFields} field(s)`,
    summaryLabel:
      `${summary.understoodFields} understood · ${summary.answerableFields} answerable · ` +
      `${summary.requiresUserInput} need your input · ${summary.requiresReview} need review`,
    rows,
  };
}
