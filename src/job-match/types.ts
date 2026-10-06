/** Raw job posting content, obtained via a JobPageSource (SDD section 6.1). Never persisted. */
export interface JobPage {
  url?: string;
  title?: string;
  text: string;
  platform?: string;
}

export type RequirementType =
  | "TITLE"
  | "SENIORITY"
  | "REQUIRED_SKILL"
  | "PREFERRED_SKILL"
  | "REQUIRED_EXPERIENCE"
  | "RESPONSIBILITY"
  | "LANGUAGE"
  | "LOCATION"
  | "WORK_MODEL"
  | "ELIGIBILITY";

export type MatchStatus = "MATCHED" | "PARTIAL" | "MISSING" | "UNCLEAR";

export type EligibilityCategory =
  | "AFFIRMATIVE_PROGRAM"
  | "WORK_AUTHORIZATION"
  | "CITIZENSHIP"
  | "SECURITY_CLEARANCE"
  | "OTHER";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/**
 * A detected eligibility-related statement in the job text (SDD section 20.1).
 * Detection is not a decision: the original phrase and a confidence level are
 * always preserved so the user can judge the context themselves.
 */
export interface EligibilityRequirement {
  type: EligibilityCategory;
  detectedPhrase: string;
  source: string;
  confidence: Confidence;
  description: string;
}

/** Surfaced to the user unchanged from EligibilityRequirement (SDD section 22). */
export type EligibilityWarning = EligibilityRequirement;

export interface JobRequirements {
  title?: string;
  seniority?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperience: string[];
  responsibilities: string[];
  languages: string[];
  location?: string;
  workModel?: string;
  eligibilityRequirements: EligibilityRequirement[];
}

export interface MatchEvidence {
  profileId: string;
  documentId: string;
  path: string;
  chunkId: string;
  excerpt?: string;
}

export interface MatchRequirement {
  requirement: string;
  type: RequirementType;
  status: MatchStatus;
  score: number;
  evidence: MatchEvidence[];
}

export type MatchRecommendation =
  | "STRONG_MATCH"
  | "GOOD_MATCH"
  | "PARTIAL_MATCH"
  | "LOW_MATCH";

export interface MatchScoringConfig {
  seniorityWeight: number;
  requiredSkillsWeight: number;
  experienceWeight: number;
  responsibilitiesWeight: number;
  languageWeight: number;
  locationWeight: number;
}

export interface MatchResult {
  score: number;
  recommendation: MatchRecommendation;

  matchedRequirements: MatchRequirement[];
  partialRequirements: MatchRequirement[];
  missingRequirements: MatchRequirement[];
  unclearRequirements: MatchRequirement[];

  eligibilityWarnings: EligibilityWarning[];

  evidence: MatchEvidence[];

  profileId: string;
}
