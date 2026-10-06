import { EXTRACTION_LIMITS } from "./extractionLimits.js";

interface JsonLdJobPosting {
  title?: string;
  description?: string;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findJobPosting(node: unknown): JsonLdJobPosting | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (typeof node !== "object" || node === null) {
    return undefined;
  }

  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));

  if (isJobPosting) {
    return {
      title: typeof obj.title === "string" ? obj.title : undefined,
      description: typeof obj.description === "string" ? stripHtml(obj.description) : undefined,
    };
  }

  if (Array.isArray(obj["@graph"])) {
    return findJobPosting(obj["@graph"]);
  }

  return undefined;
}

/**
 * Safely reads a `JobPosting` out of `<script type="application/ld+json">`
 * contents (SDD section 10, Layer 2). Only ever calls `JSON.parse` inside a
 * try/catch — page content is never executed (SDD section 30).
 */
export function extractJobPostingFromJsonLd(jsonLdTexts: string[]): JsonLdJobPosting | undefined {
  for (const raw of jsonLdTexts) {
    if (raw.length === 0 || raw.length > EXTRACTION_LIMITS.maxJsonLdBytes) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const found = findJobPosting(parsed);
    if (found && (found.title || found.description)) {
      return found;
    }
  }
  return undefined;
}
