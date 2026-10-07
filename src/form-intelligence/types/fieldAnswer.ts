/**
 * Where a FieldAnswer's value ultimately came from (SDD "Form
 * Intelligence" section 6) — independent from `FieldIntent.answerStrategy`
 * by design: the strategy is a *suggestion* based on field type, the
 * source is what *actually* happened, and it may be downgraded (never
 * upgraded) when the profile lacks real evidence.
 */
export type FieldAnswerSource = "PROFILE" | "PROFILE_RETRIEVAL" | "DERIVED" | "USER_REQUIRED" | "NONE";

/** Same traceability shape as job-match's `MatchEvidence` (profileId/documentId/path/chunkId/excerpt), kept as its own type so form-intelligence doesn't depend on the job-match domain. */
export interface RetrievalEvidence {
  profileId: string;
  documentId: string;
  path: string;
  chunkId: string;
  score: number;
  excerpt: string;
}

export interface FieldAnswer {
  fieldId: string;
  value?: string | string[];
  confidence: number;
  source: FieldAnswerSource;
  evidence: RetrievalEvidence[];
  requiresReview: boolean;
}
