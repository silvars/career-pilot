/**
 * Semantic meaning of a form field, independent of its technical name
 * (SDD "Form Intelligence" section 3) — classification is deterministic
 * (keyword/regex + field context), never an LLM.
 */
export type SemanticFieldType =
  | "IDENTITY"
  | "CONTACT"
  | "CURRENT_JOB_TITLE"
  | "PROFESSIONAL_SUMMARY"
  | "EXPERIENCE"
  | "SKILL_EXPERIENCE"
  | "LEADERSHIP_EXPERIENCE"
  | "MOTIVATION"
  | "SALARY_EXPECTATION"
  | "WORK_AUTHORIZATION"
  | "VISA_SPONSORSHIP"
  | "LOCATION"
  | "RELOCATION"
  | "WORK_MODEL"
  | "LINKEDIN"
  | "GITHUB"
  | "PORTFOLIO"
  | "EDUCATION"
  | "LANGUAGE"
  | "CUSTOM_QUESTION"
  | "UNKNOWN"
  // FASE 5.5 hardening — real validation findings:
  /** Nationality/citizenship/race/gender/religion/sexual orientation/disability/veteran status/generic legal-eligibility self-ID — never answered from the Profile, regardless of keyword match elsewhere. */
  | "PROTECTED_OR_LEGAL"
  /** CPF/passport/other government document numbers — the Profile deliberately never stores these. */
  | "DOCUMENT_ID"
  /** CAPTCHA/anti-bot and other framework-internal plumbing (hidden mirror inputs, CSRF tokens) — not a real question for the user at all. */
  | "SYSTEM_FIELD";

/**
 * How a field is expected to be answered later (SDD section 4) — decided
 * here based on the semantic type alone (e.g. SALARY_EXPECTATION should
 * never be guessed). Actual answer generation is Fatia 3; this slice only
 * assigns the strategy.
 */
export type AnswerStrategy =
  | "PROFILE_VALUE"
  | "PROFILE_RETRIEVAL"
  | "DERIVED"
  | "USER_INPUT_REQUIRED"
  | "DO_NOT_ANSWER";

export interface FieldIntent {
  fieldId: string;
  semanticType: SemanticFieldType;
  normalizedQuestion: string;
  /** 0-1, deterministic (based on which signal matched: label > ariaLabel > options > placeholder > section > identifier), never a model confidence score. */
  confidence: number;
  /** Traceable "<signal>: matched \"<keyword>\"" entries — no hallucination, every classification must point at real field data. */
  evidence: string[];
  answerStrategy: AnswerStrategy;
}
