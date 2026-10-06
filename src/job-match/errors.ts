export type JobMatchErrorCode =
  | "JOB_PAGE_NOT_READABLE"
  | "JOB_REQUIREMENTS_NOT_FOUND"
  | "JOB_ANALYSIS_FAILED"
  | "MATCH_ANALYSIS_FAILED"
  | "NO_RELEVANT_PROFILE_CONTEXT";

export class JobMatchError extends Error {
  readonly code: JobMatchErrorCode;

  constructor(code: JobMatchErrorCode, message: string) {
    super(message);
    this.name = "JobMatchError";
    this.code = code;
  }
}
