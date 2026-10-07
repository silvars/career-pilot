import type { FormField } from "./formField.js";
import type { FieldIntent } from "./fieldIntent.js";
import type { FieldAnswer } from "./fieldAnswer.js";

export interface FormSummary {
  totalFields: number;
  understoodFields: number;
  answerableFields: number;
  requiresUserInput: number;
  requiresReview: number;
  unknownFields: number;
}

export interface FormIntelligenceResult {
  url?: string;
  fields: FormField[];
  intents: FieldIntent[];
  answers: FieldAnswer[];
  summary: FormSummary;
}
