/**
 * Deterministic pt-BR <-> EN concept normalizer (real finding, 2026-10-06):
 * a job requirement written in Portuguese and a profile written in English
 * (or vice versa) share no literal tokens, so the plain KeywordRetriever
 * (prefix/token overlap, SDD section 16) under-reports real matches as
 * MISSING purely because of language, not because the candidate lacks the
 * experience.
 *
 * This module sits between JobRequirements and the KeywordRetriever. It
 * never rewrites the requirement text shown to the user and never changes
 * scoring/weights — it only proposes extra retrieval *query variants* that
 * MatchEngine tries in addition to the original text, keeping whichever
 * scores best (so this can only add recall, never remove it).
 *
 * Curated and explicit only — no ontology, no NLP, no translation service,
 * no embeddings (same philosophy as SENIORITY_PRIORITY / REQUIREMENT_DICTIONARY).
 */

export type RequirementDomain =
  | "leadership"
  | "people_management"
  | "engineering"
  | "architecture"
  | "product"
  | "business"
  | "reliability"
  | "observability"
  | "delivery"
  | "cloud"
  | "communication"
  | "seniority"
  | "work_model";

export interface RequirementConcept {
  canonical: string;
  domain: RequirementDomain;
  /** Representative English phrase, used as a retrieval query variant. */
  en: string;
  /** Representative Portuguese phrase, used as a retrieval query variant. */
  pt: string;
  /** Additional surface forms (either language) used only to detect the concept in free text. */
  aliases?: string[];
}

function foldDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatching(text: string): string {
  return foldDiacritics(text.toLowerCase());
}

// "cloud" and "seniority" domains are declared for completeness (SDD
// request) but have no curated concepts yet: cloud/tooling terms (AWS,
// Kubernetes...) are already language-neutral loanwords handled by
// skillVocabulary.ts, and seniority labels (SENIORITY_PRIORITY in
// jobAnalyzer.ts) are already used verbatim in pt-BR postings (e.g.
// "Engineering Manager") — no translation gap found there yet.
export const REQUIREMENT_CONCEPTS: RequirementConcept[] = [
  {
    canonical: "people_management",
    domain: "people_management",
    en: "people management",
    pt: "gestão de pessoas",
    aliases: ["people leadership", "gerenciando pessoas", "liderança de pessoas"],
  },
  {
    canonical: "people_development",
    domain: "people_management",
    en: "people development",
    pt: "desenvolvimento de pessoas",
  },
  {
    canonical: "career_development",
    domain: "people_management",
    en: "career development",
    pt: "desenvolvimento de carreira",
  },
  {
    canonical: "continuous_feedback",
    domain: "people_management",
    en: "continuous feedback",
    pt: "feedback contínuo",
    aliases: ["1:1s", "1:1"],
  },
  {
    canonical: "technical_leadership",
    domain: "leadership",
    en: "technical leadership",
    pt: "liderança técnica",
  },
  {
    canonical: "engineering_leadership",
    domain: "leadership",
    en: "engineering leadership",
    pt: "liderança de engenharia",
  },
  {
    canonical: "engineering_management",
    domain: "engineering",
    en: "engineering management",
    pt: "gestão de engenharia",
  },
  {
    canonical: "production_software",
    domain: "engineering",
    en: "production software",
    pt: "software em produção",
    aliases: ["operando software em produção", "operar software em produção"],
  },
  {
    canonical: "ownership_end_to_end",
    domain: "engineering",
    en: "end-to-end ownership",
    pt: "dono de ponta a ponta",
    aliases: ["you build it you run it", "you build it, you run it"],
  },
  {
    canonical: "distributed_systems",
    domain: "architecture",
    en: "distributed systems",
    pt: "sistemas distribuídos",
    aliases: ["distributed architecture", "arquitetura distribuída"],
  },
  {
    canonical: "product_partnership",
    domain: "product",
    en: "product partnership",
    pt: "parceria com produto",
    aliases: ["parceria com product managers", "partnership with product managers"],
  },
  {
    canonical: "product_discovery",
    domain: "product",
    en: "product discovery",
    pt: "discovery de produto",
    aliases: ["discovery e estratégia de produto"],
  },
  {
    canonical: "business_objectives",
    domain: "business",
    en: "business objectives",
    pt: "objetivos de negócio",
    aliases: [
      "business outcomes",
      "measurable business outcomes",
      "customer outcomes",
      "resultados de negócio",
      "resultado de negócio",
      "resultados mensuráveis",
      "foco em resultados",
      "foco em resultado",
      "foco genuíno em resultado",
    ],
  },
  {
    canonical: "reliability",
    domain: "reliability",
    en: "reliability",
    pt: "confiabilidade",
  },
  {
    canonical: "observability",
    domain: "observability",
    en: "observability",
    pt: "observabilidade",
  },
  {
    canonical: "delivery_capacity",
    domain: "delivery",
    en: "delivery capacity",
    pt: "capacidade de entrega",
  },
  {
    canonical: "stakeholder_communication",
    domain: "communication",
    en: "stakeholder communication",
    pt: "comunicação com stakeholders",
    aliases: ["públicos técnicos e não técnicos", "comunicação clara"],
  },
  {
    canonical: "remote_work",
    domain: "work_model",
    en: "remote",
    pt: "trabalho remoto",
    aliases: ["remoto", "remota"],
  },
  // Added for the 4 documented false negatives (SDD "Local Semantic Retrieval"
  // section 40.1 / FASE 5.5 hardening): these concepts previously had no
  // entry at all, so bestAcrossVariants only ever tried the literal
  // requirement text as its single query — these are strictly additive
  // extra phrasings, never a scoring/threshold change.
  {
    canonical: "team_autonomy",
    domain: "leadership",
    en: "team autonomy",
    pt: "autonomia do time",
    aliases: [
      "autonomy",
      "autonomia",
      "team ownership",
      "ownership of decisions",
      "supported rather than controlled",
      "donos das decisões",
    ],
  },
  {
    canonical: "process_simplification",
    domain: "leadership",
    en: "reducing bureaucracy",
    pt: "redução de burocracia",
    aliases: [
      "process simplification",
      "simplificação de processos",
      "simplificar processos",
      "bureaucracy",
      "burocracia",
      "distributed decision making",
      "tomada de decisão distribuída",
      "remover bloqueios",
      "bloqueios organizacionais",
      "camadas de controle",
    ],
  },
  {
    canonical: "technical_proximity",
    domain: "leadership",
    en: "staying technically close to the team",
    pt: "proximidade técnica com o time",
    aliases: [
      "hands-on technical leadership",
      "liderança técnica próxima",
      "technically close",
      "close to the code",
      "perto da tecnologia",
      "próximo da tecnologia",
      "manter-se próximo da tecnologia",
    ],
  },
];

const INDEX = REQUIREMENT_CONCEPTS.map((concept) => ({
  concept,
  needles: [concept.en, concept.pt, ...(concept.aliases ?? [])].map(normalizeForMatching),
}));

export interface NormalizedRequirementQuery {
  /** The untouched input text — never mutated, never shown differently to the user. */
  original: string;
  /** Canonical ids of every concept recognized in `original`. */
  concepts: string[];
  /** Deduplicated strings to try against the retriever; `original` is always included as a safety-net variant. */
  queryVariants: string[];
}

/**
 * Detects every curated concept mentioned in `text`, regardless of which
 * language it was written in, and returns the matching English/Portuguese
 * query variants plus the original text as a final fallback.
 */
export function normalizeForRetrieval(text: string): NormalizedRequirementQuery {
  const haystack = normalizeForMatching(text);
  const concepts: string[] = [];
  const queryVariants: string[] = [];

  for (const { concept, needles } of INDEX) {
    if (needles.some((needle) => haystack.includes(needle))) {
      concepts.push(concept.canonical);
      queryVariants.push(concept.en, concept.pt);
    }
  }

  queryVariants.push(text);

  return { original: text, concepts, queryVariants: Array.from(new Set(queryVariants)) };
}
