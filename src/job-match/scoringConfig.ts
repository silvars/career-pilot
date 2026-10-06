import type { MatchScoringConfig } from "./types.js";

/** SDD section 16: weights are internal configuration, not a user-facing preference in V1. */
export const DEFAULT_MATCH_SCORING: MatchScoringConfig = {
  seniorityWeight: 20,
  requiredSkillsWeight: 30,
  experienceWeight: 20,
  responsibilitiesWeight: 15,
  languageWeight: 10,
  locationWeight: 5,
};
