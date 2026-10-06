/**
 * Curated, deterministic equivalence table (SDD section 29). Only
 * explicitly registered synonyms are normalized — no ontology, no NLP.
 * synonyms[0] is the canonical phrase used to query the profile.
 */
export const REQUIREMENT_DICTIONARY: Record<string, string[]> = {
  peopleManagement: [
    "people management",
    "people leadership",
    "team management",
    "team leadership",
    "manage engineers",
  ],
  engineeringManagement: [
    "engineering manager",
    "software engineering manager",
    "engineering leadership",
    "engineering management",
  ],
  distributedSystems: [
    "distributed systems",
    "distributed architecture",
    "distributed computing",
  ],
};

export interface NormalizedRequirement {
  /** The original, unmodified text extracted from the job posting. */
  original: string;
  /** The canonical phrase used to query the profile (synonyms[0] of the matched concept, or `original` if no concept matched). */
  canonicalQuery: string;
  /** The dictionary concept key that matched, if any. */
  concept?: string;
}

export function normalizeRequirement(text: string): NormalizedRequirement {
  const lower = text.toLowerCase();

  for (const [concept, synonyms] of Object.entries(REQUIREMENT_DICTIONARY)) {
    for (const synonym of synonyms) {
      if (lower.includes(synonym)) {
        return { original: text, canonicalQuery: synonyms[0], concept };
      }
    }
  }

  return { original: text, canonicalQuery: text };
}
