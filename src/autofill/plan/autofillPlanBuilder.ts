import type { FormField } from "../../form-intelligence/types/formField.js";
import type { FieldIntent, SemanticFieldType } from "../../form-intelligence/types/fieldIntent.js";
import type { FieldAnswer } from "../../form-intelligence/types/fieldAnswer.js";
import type { AutofillAction, AutofillPlan } from "../types/autofillAction.js";
import { matchOption } from "./optionMatcher.js";
import { matchCheckboxIntent } from "./checkboxIntent.js";

/**
 * Never auto-filled regardless of what FieldAnswer.source says (defense in
 * depth — same philosophy as the FASE 5.5 protected-characteristic gate):
 * UNKNOWN/SYSTEM_FIELD are "not a real question"; PROTECTED_OR_LEGAL/
 * DOCUMENT_ID must always go through the user explicitly.
 */
const BLOCKED_SEMANTIC_TYPES: ReadonlySet<SemanticFieldType> = new Set([
  "UNKNOWN",
  "SYSTEM_FIELD",
  "PROTECTED_OR_LEGAL",
  "DOCUMENT_ID",
]);

function skip(fieldId: string, confidence: number, requiresReview: boolean, reason: string): AutofillAction {
  return { fieldId, action: "SKIP", confidence, requiresReview, reason };
}

function buildAction(field: FormField, intent: FieldIntent | undefined, answer: FieldAnswer | undefined): AutofillAction {
  const confidence = answer?.confidence ?? 0;
  const requiresReview = answer?.requiresReview ?? true;

  if (!answer) {
    return skip(field.id, confidence, requiresReview, "no answer value");
  }
  if (answer.source === "USER_REQUIRED" || answer.source === "NONE") {
    return skip(field.id, confidence, requiresReview, `source is ${answer.source}`);
  }
  if (intent && BLOCKED_SEMANTIC_TYPES.has(intent.semanticType)) {
    return skip(field.id, confidence, requiresReview, `semanticType ${intent.semanticType} is never auto-filled`);
  }
  if (answer.value === undefined) {
    return skip(field.id, confidence, requiresReview, "no answer value");
  }

  const value = Array.isArray(answer.value) ? answer.value[0] : answer.value;
  if (value === undefined) {
    return skip(field.id, confidence, requiresReview, "empty value");
  }

  switch (field.elementType) {
    case "TEXT":
    case "TEXTAREA":
      return { fieldId: field.id, action: "SET_VALUE", value, confidence, requiresReview };

    case "SELECT":
    case "RADIO": {
      const option = matchOption(field, value);
      if (!option) {
        return skip(field.id, confidence, requiresReview, "no safe option match");
      }
      return { fieldId: field.id, action: "SELECT_OPTION", optionLabel: option.label, value: option.value, confidence, requiresReview };
    }

    case "COMBOBOX": {
      // SDD "Autofill" section 5.6: never assume role=combobox behaves like
      // <select> — only safe when it's backed by known options (e.g. a
      // <datalist>); otherwise plan-time SKIP, not a guessed SET_VALUE.
      if (!field.options || field.options.length === 0) {
        return skip(field.id, confidence, requiresReview, "combobox without known options is not safely fillable");
      }
      const option = matchOption(field, value);
      if (!option) {
        return skip(field.id, confidence, requiresReview, "no safe option match");
      }
      return { fieldId: field.id, action: "SELECT_OPTION", optionLabel: option.label, value: option.value, confidence, requiresReview };
    }

    case "CHECKBOX": {
      const checkboxIntent = matchCheckboxIntent(answer.value);
      if (!checkboxIntent) {
        return skip(field.id, confidence, requiresReview, "no explicit checkbox intent");
      }
      return { fieldId: field.id, action: checkboxIntent, confidence, requiresReview };
    }
  }
}

/**
 * Turns FormField[] + FieldIntent[] + FieldAnswer[] (FASE 5) into an
 * explicit AutofillPlan (SDD "Autofill" section 4) — no DOM access here,
 * purely a decision/plan step. Never upgrades an answer the way FASE 5
 * already refuses to invent one; this only ever downgrades to SKIP.
 */
export function buildAutofillPlan(
  fields: FormField[],
  intents: FieldIntent[],
  answers: FieldAnswer[],
  formId?: string
): AutofillPlan {
  const intentByFieldId = new Map(intents.map((intent) => [intent.fieldId, intent]));
  const answerByFieldId = new Map(answers.map((answer) => [answer.fieldId, answer]));

  const actions = fields.map((field) => buildAction(field, intentByFieldId.get(field.id), answerByFieldId.get(field.id)));

  const summary = {
    total: actions.length,
    fillable: actions.filter((action) => action.action !== "SKIP").length,
    requiresReview: actions.filter((action) => action.requiresReview).length,
    skipped: actions.filter((action) => action.action === "SKIP").length,
  };

  return { formId, actions, summary };
}
