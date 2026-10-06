/** Error codes explicitly defined by the Profile Reader & Knowledge Retrieval SDD. */
export type ProfileErrorCode =
  | "PROFILE_NOT_FOUND"
  | "MANIFEST_NOT_FOUND"
  | "MANIFEST_INVALID"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_LOAD_ERROR"
  | "MARKDOWN_INVALID"
  | "NO_RELEVANT_CONTEXT";

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;

  constructor(code: ProfileErrorCode, message: string) {
    super(message);
    this.name = "ProfileError";
    this.code = code;
  }
}
