import { ProfileError } from "./errors.js";
import type { CareerContext, Profile, RetrievalResult } from "./types.js";

export interface CareerContextBuilder {
  build(query: string, results: RetrievalResult[]): CareerContext;
}

/** Combines retrieved chunks into a traceable, non-hallucinated context (SDD sections 21-23). */
export class DefaultCareerContextBuilder implements CareerContextBuilder {
  constructor(private readonly profile: Profile) {}

  build(query: string, results: RetrievalResult[]): CareerContext {
    if (results.length === 0) {
      throw new ProfileError(
        "NO_RELEVANT_CONTEXT",
        `No relevant context found for query: "${query}".`
      );
    }

    return {
      query,
      candidateName: this.profile.name,
      items: results.map((result) => ({
        title: result.chunk.title,
        content: result.chunk.content,
        profileId: result.chunk.profileId,
        documentId: result.chunk.documentId,
        path: result.chunk.path,
        chunkId: result.chunk.id,
        score: result.score,
      })),
    };
  }
}
