import type { AnswerStrategy, SemanticFieldType } from "../types/fieldIntent.js";

/**
 * Curated, deterministic keyword table (same philosophy as
 * `src/job-match/requirementDictionary.ts` / `requirementNormalizer.ts`:
 * no ontology, no NLP, no LLM — only explicitly registered phrases).
 * Checked (case/diacritics-insensitive, substring) against every weighted
 * text signal a field exposes (see `fieldClassifier.ts`).
 *
 * Order matters: earlier entries are tried first, so more specific
 * concepts (e.g. LEADERSHIP_EXPERIENCE, VISA_SPONSORSHIP) are listed
 * before the generic ones they could otherwise be swallowed by
 * (EXPERIENCE, WORK_AUTHORIZATION).
 *
 * `answerStrategy` encodes the SDD section 6/7 rules (e.g. salary/visa/
 * work authorization/relocation/work model are explicitly never inferred)
 * — it is a per-type default, assigned here once and for all; Fatia 3 may
 * still downgrade a specific field to USER_INPUT_REQUIRED/NONE if the
 * profile has no real evidence, but it must never upgrade a
 * USER_INPUT_REQUIRED type into an invented answer.
 */
export interface SemanticFieldConcept {
  type: SemanticFieldType;
  textKeywords: string[];
  answerStrategy: AnswerStrategy;
}

export const SEMANTIC_FIELD_CONCEPTS: SemanticFieldConcept[] = [
  {
    type: "LINKEDIN",
    textKeywords: ["linkedin"],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "GITHUB",
    textKeywords: ["github"],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "PORTFOLIO",
    textKeywords: ["portfolio", "portfólio", "personal website", "personal site", "site pessoal"],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "VISA_SPONSORSHIP",
    textKeywords: ["visa sponsorship", "require sponsorship", "sponsorship", "patrocinio de visto", "visto de trabalho"],
    answerStrategy: "USER_INPUT_REQUIRED",
  },
  {
    type: "WORK_AUTHORIZATION",
    textKeywords: [
      "work authorization",
      "authorized to work",
      "legally authorized",
      "eligible to work",
      "autorizacao de trabalho",
      "autorizado a trabalhar",
    ],
    answerStrategy: "USER_INPUT_REQUIRED",
  },
  {
    type: "SALARY_EXPECTATION",
    textKeywords: [
      "expected salary",
      "salary expectation",
      "salary",
      "compensation expectation",
      "pretensao salarial",
      "salario",
      "remuneracao",
    ],
    answerStrategy: "USER_INPUT_REQUIRED",
  },
  {
    type: "RELOCATION",
    textKeywords: ["willing to relocate", "relocation", "relocate", "disposto a se mudar", "mudanca de cidade"],
    answerStrategy: "USER_INPUT_REQUIRED",
  },
  {
    type: "WORK_MODEL",
    textKeywords: [
      "work model",
      "modelo de trabalho",
      "remote / hybrid",
      "remote, hybrid",
      "on-site",
      "onsite",
      "presencial",
      "hibrido",
      "remoto",
      "remote",
      "hybrid",
    ],
    answerStrategy: "USER_INPUT_REQUIRED",
  },
  {
    type: "LOCATION",
    textKeywords: [
      "current location",
      "where are you based",
      "localizacao",
      "cidade atual",
      "onde voce mora",
      "location",
      "city",
    ],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "LEADERSHIP_EXPERIENCE",
    textKeywords: ["leadership experience", "leadership", "lideranca", "experiencia de lideranca"],
    answerStrategy: "PROFILE_RETRIEVAL",
  },
  {
    type: "MOTIVATION",
    textKeywords: [
      "why are you interested",
      "why do you want",
      "why this company",
      "why us",
      "motivation",
      "por que voce",
      "motivacao",
      "interesse pela vaga",
    ],
    answerStrategy: "PROFILE_RETRIEVAL",
  },
  {
    type: "PROFESSIONAL_SUMMARY",
    textKeywords: [
      "tell us about yourself",
      "about yourself",
      "professional summary",
      "summary",
      "bio",
      "resumo profissional",
      "fale sobre voce",
      "conte sobre voce",
    ],
    answerStrategy: "PROFILE_RETRIEVAL",
  },
  {
    type: "CURRENT_JOB_TITLE",
    textKeywords: [
      "current job title",
      "current title",
      "current role",
      "current position",
      "job title",
      "cargo atual",
      "titulo atual",
    ],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "EDUCATION",
    textKeywords: ["education", "degree", "university", "formacao academica", "educacao", "graduacao", "faculdade"],
    answerStrategy: "PROFILE_RETRIEVAL",
  },
  {
    type: "LANGUAGE",
    textKeywords: ["language", "languages", "idioma", "idiomas", "proficiency", "fluencia"],
    answerStrategy: "PROFILE_RETRIEVAL",
  },
  {
    type: "EXPERIENCE",
    textKeywords: [
      "years of experience",
      "how many years",
      "total experience",
      "anos de experiencia",
      "experiencia total",
      "tempo de experiencia",
    ],
    answerStrategy: "DERIVED",
  },
  {
    type: "CONTACT",
    textKeywords: ["email", "e-mail", "phone number", "phone", "telefone", "contact", "mobile", "celular"],
    answerStrategy: "PROFILE_VALUE",
  },
  {
    type: "IDENTITY",
    textKeywords: ["full name", "your name", "first name", "last name", "legal name", "nome completo", "primeiro nome", "sobrenome"],
    answerStrategy: "PROFILE_VALUE",
  },
];
