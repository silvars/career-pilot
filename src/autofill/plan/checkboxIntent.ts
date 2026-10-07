function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const CHECK_WORDS = new Set(["true", "yes", "sim", "agree", "concordo", "aceito", "accept", "confirm", "confirmo"]);
const UNCHECK_WORDS = new Set(["false", "no", "nao", "disagree", "discordo", "recuso", "decline"]);

/**
 * Explicit, safe checkbox intent only (FASE 6.1 LACUNA 1 decision: "só
 * gerar CHECK/UNCHECK quando houver intenção explícita e evidência
 * segura"). Requires the *entire* (trimmed, normalized) answer value to be
 * one of a small curated set of unambiguous words — never inferred from a
 * longer sentence or partial match. FASE 5 doesn't currently produce
 * boolean-shaped answers for CHECKBOX fields, so this will legitimately
 * return `undefined` (-> SKIP) for most real checkboxes today; that's the
 * safe, intended default, not a bug.
 */
export function matchCheckboxIntent(value: string | string[] | undefined): "CHECK" | "UNCHECK" | undefined {
  if (value === undefined || Array.isArray(value)) {
    return undefined;
  }
  const normalized = normalize(value);
  if (CHECK_WORDS.has(normalized)) {
    return "CHECK";
  }
  if (UNCHECK_WORDS.has(normalized)) {
    return "UNCHECK";
  }
  return undefined;
}
