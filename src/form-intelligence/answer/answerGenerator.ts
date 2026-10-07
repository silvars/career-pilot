import { ProfileError } from "../../profile/errors.js";
import type { ProfileRetriever } from "../../profile/retriever.js";
import type { RetrievalResult } from "../../profile/types.js";
import type { FieldIntent } from "../types/fieldIntent.js";
import type { SemanticFieldType } from "../types/fieldIntent.js";
import type { FieldAnswer, RetrievalEvidence } from "../types/fieldAnswer.js";
import {
  extractCurrentJobTitle,
  extractEmail,
  extractExplicitYearsOfExperience,
  extractFullName,
  extractGitHub,
  extractLinkedIn,
  extractLocation,
  extractPortfolio,
} from "./canonicalProfileExtractors.js";

export interface AnswerGenerationDeps {
  retriever: ProfileRetriever;
}

function foldDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatching(text: string): string {
  return foldDiacritics(text.toLowerCase());
}

const PHONE_KEYWORDS = ["phone", "telefone", "mobile", "celular"];

/**
 * Real finding from Fatia 4 live validation (a real Greenhouse EEO/self-ID
 * section): a demographic question like "Which gender do you identify as?"
 * falls through classification as CUSTOM_QUESTION (no keyword in the
 * SemanticFieldType dictionary is specific enough to catch it) and would
 * otherwise be answered via generic retrieval — directly violating "nunca
 * inferir: ...genero; raca; religiao; outras caracteristicas pessoais".
 * This is a hard safety gate, checked before any strategy runs, regardless
 * of what the classifier decided.
 */
const PROTECTED_CHARACTERISTIC_KEYWORDS = [
  "gender",
  "genero",
  "race",
  "raca",
  "ethnicity",
  "etnia",
  "hispanic",
  "latino",
  "disability",
  "deficiencia",
  "veteran",
  "sexual orientation",
  "orientacao sexual",
  "religion",
  "religiao",
  "pregnan",
  "gravidez",
];

function mentionsProtectedCharacteristic(text: string): boolean {
  const normalized = normalizeForMatching(text);
  return PROTECTED_CHARACTERISTIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/** Canonical facts can be "mentioned" in several chunks (e.g. a narrative "LinkedIn summary" chunk vs. the actual canonical identity bullet list) — scan a bit deeper than the default topK so the regex gets a real shot at the right one. */
const CANONICAL_TOP_K = 5;

function toRetrievalEvidence(result: RetrievalResult): RetrievalEvidence {
  return {
    profileId: result.chunk.profileId,
    documentId: result.chunk.documentId,
    path: result.chunk.path,
    chunkId: result.chunk.id,
    score: result.score,
    excerpt: result.chunk.content.slice(0, 240),
  };
}

/** Never throws: a retriever finding nothing is a normal, expected outcome here, not a failure. */
async function safeSearch(retriever: ProfileRetriever, query: string, topK = 3): Promise<RetrievalResult[]> {
  try {
    return await retriever.search(query, { topK, minScore: 0 });
  } catch (cause) {
    if (cause instanceof ProfileError && cause.code === "NO_RELEVANT_CONTEXT") {
      return [];
    }
    throw cause;
  }
}

function userRequired(intent: FieldIntent): FieldAnswer {
  return { fieldId: intent.fieldId, confidence: 0, source: "USER_REQUIRED", evidence: [], requiresReview: true };
}

function none(intent: FieldIntent): FieldAnswer {
  return { fieldId: intent.fieldId, confidence: 0, source: "NONE", evidence: [], requiresReview: false };
}

/**
 * One query per canonical fact (SDD section 5: reuse the existing
 * retriever, never a second index/mechanism). Phrased to include the
 * chunk's own section wording ("canonical identity", "current role") so
 * title-weighted keyword scoring reliably ranks the real canonical chunk
 * first even when other chunks mention the same raw keyword (e.g. a
 * narrative "LinkedIn summary" chunk) — verified against the real
 * vendored profile, not assumed.
 */
const CANONICAL_QUERIES: Partial<Record<SemanticFieldType, string>> = {
  IDENTITY: "canonical identity full legal name",
  LOCATION: "canonical identity current city location",
  LINKEDIN: "canonical identity LinkedIn URL",
  GITHUB: "canonical identity GitHub URL",
  PORTFOLIO: "canonical identity personal website portfolio",
};

const CANONICAL_EXTRACTORS: Partial<Record<SemanticFieldType, (content: string) => string | undefined>> = {
  IDENTITY: extractFullName,
  LOCATION: extractLocation,
  LINKEDIN: extractLinkedIn,
  GITHUB: extractGitHub,
  PORTFOLIO: extractPortfolio,
};

async function answerContact(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  const isPhone = PHONE_KEYWORDS.some((keyword) => normalizeForMatching(intent.normalizedQuestion).includes(keyword));
  if (isPhone) {
    // Rule 4: the phone number is deliberately kept out of the public profile — never invent one.
    return userRequired(intent);
  }

  const results = await safeSearch(deps.retriever, "email address", CANONICAL_TOP_K);
  for (const result of results) {
    const value = extractEmail(result.chunk.content);
    if (value) {
      return {
        fieldId: intent.fieldId,
        value,
        confidence: result.score,
        source: "PROFILE",
        evidence: [toRetrievalEvidence(result)],
        requiresReview: false,
      };
    }
  }
  return userRequired(intent);
}

async function answerCurrentJobTitle(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  const results = await safeSearch(deps.retriever, "current job title and company current role", CANONICAL_TOP_K);
  for (const result of results) {
    const value = extractCurrentJobTitle(result.chunk.content);
    if (value) {
      return {
        fieldId: intent.fieldId,
        value,
        confidence: result.score,
        source: "PROFILE",
        evidence: [toRetrievalEvidence(result)],
        requiresReview: true, // a canonical field, but applications sometimes want a tailored phrasing — worth a human glance
      };
    }
  }
  return userRequired(intent);
}

async function answerCanonicalProfileValue(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  if (intent.semanticType === "CONTACT") {
    return answerContact(intent, deps);
  }
  if (intent.semanticType === "CURRENT_JOB_TITLE") {
    return answerCurrentJobTitle(intent, deps);
  }

  const query = CANONICAL_QUERIES[intent.semanticType];
  const extractor = CANONICAL_EXTRACTORS[intent.semanticType];
  if (!query || !extractor) {
    return userRequired(intent);
  }

  const results = await safeSearch(deps.retriever, query, CANONICAL_TOP_K);
  for (const result of results) {
    const value = extractor(result.chunk.content);
    if (value) {
      return {
        fieldId: intent.fieldId,
        value,
        confidence: result.score,
        source: "PROFILE",
        evidence: [toRetrievalEvidence(result)],
        requiresReview: false,
      };
    }
  }
  return userRequired(intent);
}

/** EXPERIENCE only — SKILL_EXPERIENCE/LEADERSHIP_EXPERIENCE go through answerFromRetrieval instead. */
async function answerYearsOfExperience(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  const results = await safeSearch(deps.retriever, intent.normalizedQuestion || "years of experience");
  for (const result of results) {
    const value = extractExplicitYearsOfExperience(result.chunk.content);
    if (value) {
      return {
        fieldId: intent.fieldId,
        value,
        confidence: result.score,
        source: "DERIVED",
        evidence: [toRetrievalEvidence(result)],
        requiresReview: true,
      };
    }
  }
  return userRequired(intent);
}

/** Open-ended narrative fields (summary/motivation/leadership/skills/education/language/custom question): the raw retrieved excerpt is the draft answer — never a synthesized paragraph (no LLM). Always needs human review before submission. */
async function answerFromRetrieval(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  const results = await safeSearch(deps.retriever, intent.normalizedQuestion);
  if (results.length === 0) {
    return userRequired(intent);
  }
  const [best, ...rest] = results;
  return {
    fieldId: intent.fieldId,
    value: best.chunk.content,
    confidence: best.score,
    source: "PROFILE_RETRIEVAL",
    evidence: [best, ...rest].map(toRetrievalEvidence),
    requiresReview: true,
  };
}

/**
 * Generates one FieldAnswer per FieldIntent (SDD "Form Intelligence"
 * section 6) — reuses the caller-supplied ProfileRetriever (KeywordRetriever
 * or HybridRetriever, FASE 4.1) exclusively, no new retrieval mechanism.
 * `answerStrategy` is only ever a starting point: whenever the profile
 * doesn't actually contain the evidence, the result is downgraded to
 * USER_REQUIRED — never upgraded into an invented value (rule 2).
 */
export async function generateAnswer(intent: FieldIntent, deps: AnswerGenerationDeps): Promise<FieldAnswer> {
  if (mentionsProtectedCharacteristic(intent.normalizedQuestion)) {
    return userRequired(intent);
  }

  switch (intent.answerStrategy) {
    case "DO_NOT_ANSWER":
      return none(intent);
    case "USER_INPUT_REQUIRED":
      return userRequired(intent);
    case "PROFILE_VALUE":
      return answerCanonicalProfileValue(intent, deps);
    case "DERIVED":
      return answerYearsOfExperience(intent, deps);
    case "PROFILE_RETRIEVAL":
      return answerFromRetrieval(intent, deps);
  }
}

export async function generateAnswers(intents: FieldIntent[], deps: AnswerGenerationDeps): Promise<FieldAnswer[]> {
  return Promise.all(intents.map((intent) => generateAnswer(intent, deps)));
}
