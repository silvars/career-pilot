import { ProfileError } from "./errors.js";
import type { ProfileChunk, RetrievalOptions, RetrievalResult } from "./types.js";

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "to", "with", "and", "or", "is",
  "are", "do", "does", "did", "have", "has", "had", "how", "what", "why",
  "many", "you", "your", "me", "i", "about", "tell", "describe", "experience",
  "o", "a", "os", "as", "de", "do", "da", "dos", "das", "em", "para", "com",
  "e", "ou", "voce", "seu", "sua", "sobre",
]);

const MIN_TOKEN_LENGTH = 2;
const PREFIX_LENGTH = 5;

export interface ProfileRetriever {
  search(query: string, options?: RetrievalOptions): Promise<RetrievalResult[]>;
}

function normalize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(word));
  return Array.from(new Set(words));
}

function prefixOf(token: string): string {
  return token.slice(0, Math.min(token.length, PREFIX_LENGTH));
}

function matchesAny(queryPrefix: string, tokens: string[]): boolean {
  return tokens.some((token) => prefixOf(token) === queryPrefix);
}

const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 2;
const CONTENT_WEIGHT = 1;
const MAX_WEIGHT = TITLE_WEIGHT;

interface IndexedChunk {
  chunk: ProfileChunk;
  titleTokens: string[];
  tagTokens: string[];
  contentTokens: string[];
}

/**
 * V1 retrieval implementation (SDD section 16): no vector database, no
 * external embeddings. Combines title/section, tag and content matching
 * with prefix-based fuzzy token comparison, so related word forms
 * ("managed" / "management") still match.
 */
export class KeywordRetriever implements ProfileRetriever {
  private readonly indexed: IndexedChunk[];

  constructor(chunks: ProfileChunk[]) {
    this.indexed = chunks.map((chunk) => ({
      chunk,
      titleTokens: normalize(chunk.title ?? ""),
      tagTokens: chunk.tags.flatMap((tag) => normalize(tag)),
      contentTokens: normalize(chunk.content),
    }));
  }

  async search(
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]> {
    const topK = options?.topK ?? 5;
    const minScore = options?.minScore ?? 0.15;

    const queryTokens = normalize(query);
    if (queryTokens.length === 0) {
      throw new ProfileError(
        "NO_RELEVANT_CONTEXT",
        `Query "${query}" did not produce any searchable terms.`
      );
    }

    const results: RetrievalResult[] = this.indexed.map(({ chunk, titleTokens, tagTokens, contentTokens }) => {
      let weightSum = 0;
      let matchedTokens = 0;
      for (const token of queryTokens) {
        const prefix = prefixOf(token);
        if (matchesAny(prefix, titleTokens)) {
          weightSum += TITLE_WEIGHT;
          matchedTokens += 1;
        } else if (matchesAny(prefix, tagTokens)) {
          weightSum += TAG_WEIGHT;
          matchedTokens += 1;
        } else if (matchesAny(prefix, contentTokens)) {
          weightSum += CONTENT_WEIGHT;
          matchedTokens += 1;
        }
      }
      // Coverage (how many distinct query terms this chunk addresses at all)
      // dominates the score. Field weight (title > tag > content) only acts
      // as a secondary tie-breaker, so a chunk that fully covers a
      // multi-word query ("distributed systems") outranks a chunk that only
      // partially matches it via an incidentally high-weight title hit.
      const coverage = matchedTokens / queryTokens.length;
      const fieldQuality = weightSum / (queryTokens.length * MAX_WEIGHT);
      const score = coverage * 0.9 + fieldQuality * 0.1;
      return { chunk, score };
    });

    const relevant = results
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (relevant.length === 0) {
      throw new ProfileError(
        "NO_RELEVANT_CONTEXT",
        `No relevant context found for query: "${query}".`
      );
    }

    return relevant;
  }
}
