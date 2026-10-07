import { extractSkills } from "../../job-match/skillVocabulary.js";
import type { FormField } from "../types/formField.js";
import type { AnswerStrategy, FieldIntent, SemanticFieldType } from "../types/fieldIntent.js";
import { humanizeIdentifier } from "../normalization/textNormalizer.js";
import { SEMANTIC_FIELD_CONCEPTS } from "./semanticFieldDictionary.js";

function foldDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatching(text: string): string {
  return foldDiacritics(text.toLowerCase());
}

/** A field's text broken out by signal, each with a confidence weight if it's the one that matches (SDD section 1 priority order, reapplied here for classification). */
interface WeightedSignal {
  name: string;
  text?: string;
  confidence: number;
}

function weightedSignals(field: FormField): WeightedSignal[] {
  const identifierText = [field.name, field.id]
    .filter((value): value is string => Boolean(value))
    .map(humanizeIdentifier)
    .join(" ");
  const optionsText = (field.options ?? []).map((option) => option.label).join(" ");

  return [
    { name: "label", text: field.label, confidence: 0.95 },
    { name: "ariaLabel", text: field.ariaLabel, confidence: 0.9 },
    { name: "options", text: optionsText, confidence: 0.85 },
    { name: "placeholder", text: field.placeholder, confidence: 0.75 },
    { name: "section", text: field.section, confidence: 0.6 },
    { name: "identifier", text: identifierText, confidence: 0.55 },
  ];
}

function matchSkillExperience(signals: WeightedSignal[]): { confidence: number; evidence: string[] } | null {
  for (const signal of signals) {
    if (!signal.text) continue;
    const normalized = normalizeForMatching(signal.text);
    const mentionsExperience = normalized.includes("experience") || normalized.includes("experiencia");
    if (!mentionsExperience) continue;
    const skills = extractSkills(signal.text);
    if (skills.length > 0) {
      return {
        confidence: signal.confidence,
        evidence: [`${signal.name}: matched skill "${skills[0]}" + "experience"`],
      };
    }
  }
  return null;
}

/** Normalizes a field's effective question text for later retrieval (SDD section 5) — strips trailing required-marker punctuation. */
function normalizedQuestion(field: FormField): string {
  const text = field.label ?? field.ariaLabel ?? field.placeholder ?? field.name ?? field.id ?? "";
  return text.replace(/[*:]+\s*$/, "").trim();
}

function isQuestionLike(field: FormField): boolean {
  const text = field.label ?? field.ariaLabel ?? field.placeholder;
  if (!text) return false;
  const wordCount = text.trim().split(/\s+/).length;
  return text.trim().endsWith("?") || wordCount >= 3;
}

/**
 * Deterministic classification (SDD "Form Intelligence" section 3) — no
 * LLM, no retrieval. Tries SKILL_EXPERIENCE (skill vocabulary reused from
 * `job-match/skillVocabulary.ts`) before the generic keyword table so
 * "Years of Java experience" isn't swallowed by plain EXPERIENCE; falls
 * back to CUSTOM_QUESTION for an unrecognized but clearly question-like
 * field, or UNKNOWN when there's nothing to go on at all.
 */
export function classifyField(field: FormField): FieldIntent {
  const signals = weightedSignals(field);

  const skillMatch = matchSkillExperience(signals);
  if (skillMatch) {
    return {
      fieldId: field.id,
      semanticType: "SKILL_EXPERIENCE",
      normalizedQuestion: normalizedQuestion(field),
      confidence: skillMatch.confidence,
      evidence: skillMatch.evidence,
      answerStrategy: "PROFILE_RETRIEVAL",
    };
  }

  for (const concept of SEMANTIC_FIELD_CONCEPTS) {
    for (const signal of signals) {
      if (!signal.text) continue;
      const normalized = normalizeForMatching(signal.text);
      const matchedKeyword = concept.textKeywords.find((keyword) => normalized.includes(normalizeForMatching(keyword)));
      if (matchedKeyword) {
        return {
          fieldId: field.id,
          semanticType: concept.type,
          normalizedQuestion: normalizedQuestion(field),
          confidence: signal.confidence,
          evidence: [`${signal.name}: matched "${matchedKeyword}"`],
          answerStrategy: concept.answerStrategy,
        };
      }
    }
  }

  const fallbackType: SemanticFieldType = isQuestionLike(field) ? "CUSTOM_QUESTION" : "UNKNOWN";
  const fallbackStrategy: AnswerStrategy = fallbackType === "CUSTOM_QUESTION" ? "PROFILE_RETRIEVAL" : "DO_NOT_ANSWER";

  return {
    fieldId: field.id,
    semanticType: fallbackType,
    normalizedQuestion: normalizedQuestion(field),
    confidence: fallbackType === "CUSTOM_QUESTION" ? 0.3 : 0,
    evidence: [],
    answerStrategy: fallbackStrategy,
  };
}

export function classifyFields(fields: FormField[]): FieldIntent[] {
  return fields.map(classifyField);
}
