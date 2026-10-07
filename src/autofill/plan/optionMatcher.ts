import type { FormField, FormOption } from "../../form-intelligence/types/formField.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Safe option match only — value first (exact), then label (exact after
 * diacritics/case/whitespace normalization). Deliberately **not** fuzzy or
 * substring-based: approving a FASE 6.1 LACUNA 1 decision ("correspondência
 * segura... nunca preencher uma opção que não exista no campo") means a
 * near-miss must SKIP, not guess which option was intended.
 */
export function matchOption(field: FormField, answerValue: string): FormOption | undefined {
  if (!field.options || field.options.length === 0) {
    return undefined;
  }
  const normalizedAnswer = normalize(answerValue);

  const byValue = field.options.find(
    (option) => option.value !== undefined && normalize(option.value) === normalizedAnswer
  );
  if (byValue) {
    return byValue;
  }

  return field.options.find((option) => normalize(option.label) === normalizedAnswer);
}
