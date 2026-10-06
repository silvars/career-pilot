import { ProfileError } from "../profile/errors.js";
import { buildIndex } from "../profile/chunker.js";
import { KeywordRetriever } from "../profile/retriever.js";
import type { Profile, RetrievalResult } from "../profile/types.js";
import { JobMatchError } from "./errors.js";
import { normalizeRequirement } from "./requirementDictionary.js";
import { DEFAULT_MATCH_SCORING } from "./scoringConfig.js";
import { LANGUAGE_NAMES } from "./jobAnalyzer.js";
import type {
  JobRequirements,
  MatchEvidence,
  MatchRecommendation,
  MatchRequirement,
  MatchResult,
  MatchScoringConfig,
  MatchStatus,
  RequirementType,
} from "./types.js";

export interface MatchEngine {
  evaluate(
    job: JobRequirements,
    profile: Profile,
    scoringConfig?: MatchScoringConfig
  ): Promise<MatchResult>;
}

// A full-coverage keyword match on the existing retriever scores ~0.93-1.0
// (SDD section 16's "basic relevance scoring"); a partial multi-term
// coverage lands around 0.3-0.85. These thresholds are deterministic and
// reused from the already-implemented, tested retriever — no second scoring
// mechanism is introduced (SDD section 3).
const MATCHED_THRESHOLD = 0.85;
const PARTIAL_THRESHOLD = 0.3;

type Category =
  | "seniority"
  | "requiredSkills"
  | "experience"
  | "responsibilities"
  | "language"
  | "location";

interface CategoryTally {
  sum: number;
  count: number;
}

function toEvidence(result: RetrievalResult): MatchEvidence {
  return {
    profileId: result.chunk.profileId,
    documentId: result.chunk.documentId,
    path: result.chunk.path,
    chunkId: result.chunk.id,
    excerpt: result.chunk.content.slice(0, 240),
  };
}

async function searchSafely(
  retriever: KeywordRetriever,
  query: string
): Promise<RetrievalResult[]> {
  try {
    return await retriever.search(query, { topK: 3 });
  } catch (cause) {
    if (cause instanceof ProfileError && cause.code === "NO_RELEVANT_CONTEXT") {
      return [];
    }
    throw cause;
  }
}

/** No hallucination (SDD section 14): MISSING always carries empty evidence. */
async function evaluateAgainstProfile(
  requirementText: string,
  type: RequirementType,
  retriever: KeywordRetriever
): Promise<MatchRequirement> {
  const { canonicalQuery } = normalizeRequirement(requirementText);
  const results = await searchSafely(retriever, canonicalQuery);

  if (results.length === 0) {
    return { requirement: requirementText, type, status: "MISSING", score: 0, evidence: [] };
  }

  const best = results[0].score;
  const status: MatchStatus =
    best >= MATCHED_THRESHOLD ? "MATCHED" : best >= PARTIAL_THRESHOLD ? "PARTIAL" : "MISSING";
  const evidence = status === "MISSING" ? [] : results.map(toEvidence);

  return { requirement: requirementText, type, status, score: Math.round(best * 100), evidence };
}

/**
 * Language requirements are evaluated conservatively (SDD section 15.5):
 * presence of the language in the profile is enough for MATCHED, but a
 * requirement for "native" proficiency that the profile doesn't literally
 * confirm stays UNCLEAR rather than being assumed true or false.
 */
async function evaluateLanguage(
  requirementText: string,
  retriever: KeywordRetriever
): Promise<MatchRequirement> {
  const languageName = LANGUAGE_NAMES.find((language) =>
    new RegExp(`\\b${language}\\b`, "i").test(requirementText)
  );
  if (!languageName) {
    return evaluateAgainstProfile(requirementText, "LANGUAGE", retriever);
  }

  const results = await searchSafely(retriever, languageName);
  if (results.length === 0) {
    return { requirement: requirementText, type: "LANGUAGE", status: "MISSING", score: 0, evidence: [] };
  }

  const requiresNative = /\bnative\b/i.test(requirementText);
  // Require the language name and "native" to co-occur on the same line —
  // otherwise a profile mentioning "native" for a *different* language (e.g.
  // "Portuguese — native") would wrongly count as evidence for this one.
  const hasNativeEvidence = results.some((result) =>
    result.chunk.content.split(/\r?\n/).some((line) => {
      const lower = line.toLowerCase();
      return lower.includes(languageName.toLowerCase()) && /\bnative\b/.test(lower);
    })
  );

  if (requiresNative && !hasNativeEvidence) {
    return {
      requirement: requirementText,
      type: "LANGUAGE",
      status: "UNCLEAR",
      score: 50,
      evidence: results.map(toEvidence),
    };
  }

  return {
    requirement: requirementText,
    type: "LANGUAGE",
    status: "MATCHED",
    score: Math.round(results[0].score * 100),
    evidence: results.map(toEvidence),
  };
}

function statusValue(status: MatchStatus): number {
  switch (status) {
    case "MATCHED":
      return 1;
    case "PARTIAL":
      return 0.5;
    case "UNCLEAR":
      return 0.5;
    case "MISSING":
      return 0;
  }
}

function addToTally(tallies: Partial<Record<Category, CategoryTally>>, category: Category, status: MatchStatus) {
  const tally = tallies[category] ?? { sum: 0, count: 0 };
  tally.sum += statusValue(status);
  tally.count += 1;
  tallies[category] = tally;
}

// A category with zero detected requirements is neutral (100): the job
// posting simply didn't mention anything for that criterion, which must not
// be held against the candidate.
function categoryScore(tally: CategoryTally | undefined): number {
  if (!tally || tally.count === 0) {
    return 100;
  }
  return (tally.sum / tally.count) * 100;
}

function recommendationFor(score: number): MatchRecommendation {
  if (score >= 90) return "STRONG_MATCH";
  if (score >= 75) return "GOOD_MATCH";
  if (score >= 60) return "PARTIAL_MATCH";
  return "LOW_MATCH";
}

/**
 * V1 rule-based match engine (SDD section 27). Reuses the existing
 * ProfileRetriever/KeywordRetriever instead of creating a second knowledge
 * mechanism (SDD section 3).
 */
export class RuleBasedMatchEngine implements MatchEngine {
  async evaluate(
    job: JobRequirements,
    profile: Profile,
    scoringConfig: MatchScoringConfig = DEFAULT_MATCH_SCORING
  ): Promise<MatchResult> {
    try {
      const chunks = buildIndex(profile).chunks;
      if (chunks.length === 0) {
        throw new JobMatchError(
          "NO_RELEVANT_PROFILE_CONTEXT",
          `Active profile "${profile.id}" has no indexed content.`
        );
      }
      const retriever = new KeywordRetriever(chunks);

      const matchedRequirements: MatchRequirement[] = [];
      const partialRequirements: MatchRequirement[] = [];
      const missingRequirements: MatchRequirement[] = [];
      const unclearRequirements: MatchRequirement[] = [];
      const tallies: Partial<Record<Category, CategoryTally>> = {};

      const classify = (requirement: MatchRequirement) => {
        if (requirement.status === "MATCHED") matchedRequirements.push(requirement);
        else if (requirement.status === "PARTIAL") partialRequirements.push(requirement);
        else if (requirement.status === "MISSING") missingRequirements.push(requirement);
        else unclearRequirements.push(requirement);
      };

      const record = async (promise: Promise<MatchRequirement>, category: Category) => {
        const requirement = await promise;
        addToTally(tallies, category, requirement.status);
        classify(requirement);
      };

      if (job.title) {
        await record(evaluateAgainstProfile(job.title, "TITLE", retriever), "seniority");
      }
      if (job.seniority) {
        await record(evaluateAgainstProfile(job.seniority, "SENIORITY", retriever), "seniority");
      }
      for (const skill of job.requiredSkills) {
        await record(evaluateAgainstProfile(skill, "REQUIRED_SKILL", retriever), "requiredSkills");
      }
      for (const skill of job.preferredSkills) {
        // SDD section 17: preferred requirements never affect the score —
        // informational only, so they are classified but not tallied.
        classify(await evaluateAgainstProfile(skill, "PREFERRED_SKILL", retriever));
      }
      for (const experience of job.requiredExperience) {
        await record(evaluateAgainstProfile(experience, "REQUIRED_EXPERIENCE", retriever), "experience");
      }
      for (const responsibility of job.responsibilities) {
        await record(evaluateAgainstProfile(responsibility, "RESPONSIBILITY", retriever), "responsibilities");
      }
      for (const language of job.languages) {
        await record(evaluateLanguage(language, retriever), "language");
      }
      if (job.location) {
        await record(evaluateAgainstProfile(job.location, "LOCATION", retriever), "location");
      }
      if (job.workModel) {
        await record(evaluateAgainstProfile(job.workModel, "WORK_MODEL", retriever), "location");
      }

      const weightedScore =
        (categoryScore(tallies.seniority) * scoringConfig.seniorityWeight +
          categoryScore(tallies.requiredSkills) * scoringConfig.requiredSkillsWeight +
          categoryScore(tallies.experience) * scoringConfig.experienceWeight +
          categoryScore(tallies.responsibilities) * scoringConfig.responsibilitiesWeight +
          categoryScore(tallies.language) * scoringConfig.languageWeight +
          categoryScore(tallies.location) * scoringConfig.locationWeight) /
        100;

      const score = Math.round(weightedScore);

      return {
        score,
        recommendation: recommendationFor(score),
        matchedRequirements,
        partialRequirements,
        missingRequirements,
        unclearRequirements,
        // Eligibility is kept fully separate from the score (SDD sections 20-21).
        eligibilityWarnings: job.eligibilityRequirements,
        evidence: [...matchedRequirements, ...partialRequirements].flatMap((r) => r.evidence),
        profileId: profile.id,
      };
    } catch (cause) {
      if (cause instanceof JobMatchError) {
        throw cause;
      }
      throw new JobMatchError("MATCH_ANALYSIS_FAILED", `Failed to evaluate match: ${String(cause)}`);
    }
  }
}
