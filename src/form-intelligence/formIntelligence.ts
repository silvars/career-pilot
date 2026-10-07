import { buildFormFields } from "./extraction/formFieldBuilder.js";
import type { RawFormMaterials } from "./extraction/rawFormElement.js";
import { classifyFields } from "./classification/fieldClassifier.js";
import { generateAnswers } from "./answer/answerGenerator.js";
import type { AnswerGenerationDeps } from "./answer/answerGenerator.js";
import type { FieldAnswer } from "./types/fieldAnswer.js";
import type { FieldIntent } from "./types/fieldIntent.js";
import type { FormIntelligenceResult, FormSummary } from "./types/formIntelligenceResult.js";

const ANSWERABLE_SOURCES = new Set(["PROFILE", "PROFILE_RETRIEVAL", "DERIVED"]);

function buildSummary(intents: FieldIntent[], answers: FieldAnswer[]): FormSummary {
  return {
    totalFields: intents.length,
    understoodFields: intents.filter((intent) => intent.semanticType !== "UNKNOWN").length,
    answerableFields: answers.filter((answer) => ANSWERABLE_SOURCES.has(answer.source)).length,
    requiresUserInput: answers.filter((answer) => answer.source === "USER_REQUIRED").length,
    requiresReview: answers.filter((answer) => answer.requiresReview).length,
    unknownFields: intents.filter((intent) => intent.semanticType === "UNKNOWN").length,
  };
}

/**
 * End-to-end FASE 5 pipeline (SDD "Form Intelligence" section 9): raw DOM
 * snapshot -> FormField[] -> FieldIntent[] -> FieldAnswer[] -> summary.
 * Never touches the DOM, never submits, never autofills (sections 13/
 * "FORA DA FASE 5") — purely produces the structured result FASE 6 will
 * consume.
 */
export async function buildFormIntelligenceResult(
  materials: RawFormMaterials,
  deps: AnswerGenerationDeps
): Promise<FormIntelligenceResult> {
  const fields = buildFormFields(materials);
  const intents = classifyFields(fields);
  const answers = await generateAnswers(intents, deps);
  const summary = buildSummary(intents, answers);

  return { url: materials.url, fields, intents, answers, summary };
}
