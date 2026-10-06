import type { Confidence, EligibilityCategory, EligibilityRequirement } from "./types.js";

/** Curated, deterministic catalog (SDD section 20.1). Detection is not a decision. */
export const ELIGIBILITY_DICTIONARY: Record<EligibilityCategory, string[]> = {
  AFFIRMATIVE_PROGRAM: [
    "affirmative action",
    "affirmative opportunity",
    "women only",
    "women applicants",
    "black candidates",
    "people with disabilities",
  ],
  WORK_AUTHORIZATION: [
    "work authorization",
    "authorized to work",
    "right to work",
  ],
  CITIZENSHIP: ["us citizen", "u.s. citizen", "citizenship required"],
  SECURITY_CLEARANCE: ["security clearance", "security clearance required"],
  OTHER: [],
};

// Default confidence per category: explicit legal/administrative requirements
// (work authorization, citizenship, clearance) read as unambiguous when the
// phrase literally appears. Affirmative-program language is more
// context-dependent (an inclusive statement is not necessarily a
// restriction), so it defaults to MEDIUM.
const DEFAULT_CONFIDENCE: Record<EligibilityCategory, Confidence> = {
  AFFIRMATIVE_PROGRAM: "MEDIUM",
  WORK_AUTHORIZATION: "HIGH",
  CITIZENSHIP: "HIGH",
  SECURITY_CLEARANCE: "HIGH",
  OTHER: "LOW",
};

const DESCRIPTIONS: Record<EligibilityCategory, (phrase: string) => string> = {
  AFFIRMATIVE_PROGRAM: (phrase) =>
    `Job description may indicate an affirmative/inclusion opportunity ("${phrase}").`,
  WORK_AUTHORIZATION: (phrase) =>
    `Job description mentions a work authorization requirement ("${phrase}").`,
  CITIZENSHIP: (phrase) =>
    `Job description mentions a citizenship requirement ("${phrase}").`,
  SECURITY_CLEARANCE: (phrase) =>
    `Job description mentions a security clearance requirement ("${phrase}").`,
  OTHER: (phrase) => `Job description mentions an eligibility-related term ("${phrase}").`,
};

function splitIntoSentences(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Detects eligibility-related statements using the curated dictionary only.
 * Each match preserves the source sentence and the specific phrase matched,
 * so the caller (user) can judge context instead of relying on a bare
 * keyword hit (SDD sections 20.1 and 21).
 */
export function detectEligibility(jobText: string): EligibilityRequirement[] {
  const sentences = splitIntoSentences(jobText);
  const found: EligibilityRequirement[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const [category, phrases] of Object.entries(ELIGIBILITY_DICTIONARY) as [
      EligibilityCategory,
      string[],
    ][]) {
      for (const phrase of phrases) {
        if (!lower.includes(phrase)) {
          continue;
        }
        // Dedupe by category+sentence (not category+phrase): a single
        // sentence often contains more than one registered synonym for the
        // same category (e.g. "security clearance" and "security clearance
        // required"), and that should surface as one warning, not several.
        const dedupeKey = `${category}::${sentence}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        found.push({
          type: category,
          detectedPhrase: phrase,
          source: sentence,
          confidence: DEFAULT_CONFIDENCE[category],
          description: DESCRIPTIONS[category](phrase),
        });
      }
    }
  }

  return found;
}
