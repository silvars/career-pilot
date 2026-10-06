import { EXTRACTION_LIMITS } from "./extractionLimits.js";
import { extractJobPostingFromJsonLd } from "./jsonLd.js";
import { detectPlatform } from "./platformDetector.js";
import { normalizeText, truncate } from "./textNormalizer.js";
import type {
  ExtractedJobPage,
  ExtractedSection,
  ExtractionDiagnostics,
  RawElement,
  RawPageMaterials,
} from "./types.js";
import type { JobPage } from "../../job-match/types.js";

const MIN_MEANINGFUL_CHARS = 40;
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

function groupElementsIntoSections(elements: RawElement[]): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  let heading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const text = normalizeText(buffer.join("\n"));
    if (text.length > 0) {
      sections.push({ heading, text, source: "dom" });
    }
    buffer = [];
  };

  for (const el of elements) {
    if (HEADING_TAGS.has(el.tag)) {
      flush();
      heading = el.text || undefined;
    } else if (el.text) {
      buffer.push(el.text);
    }
  }
  flush();

  return sections;
}

/**
 * Pure extraction pipeline (SDD sections 10-12): takes the plain materials a
 * content script collected and produces a normalized, size-limited
 * `ExtractedJobPage` plus diagnostics. Contains no DOM/Chrome API — fully
 * unit-testable (decision 1.1 / SDD principle 12).
 */
export function buildExtractedJobPage(raw: RawPageMaterials): {
  extracted: ExtractedJobPage;
  diagnostics: ExtractionDiagnostics;
} {
  let truncatedAnywhere = false;

  const jsonLd = extractJobPostingFromJsonLd(raw.jsonLdTexts);
  const structuredSection: ExtractedSection | undefined = jsonLd?.description
    ? { heading: jsonLd.title, text: normalizeText(jsonLd.description), source: "metadata" }
    : undefined;

  const domSections = groupElementsIntoSections(raw.elements);
  const hasStructured = Boolean(structuredSection);
  const hasDom = domSections.length > 0;

  let allSections: ExtractedSection[];
  let source: ExtractionDiagnostics["source"];

  if (hasStructured && hasDom) {
    allSections = [structuredSection as ExtractedSection, ...domSections];
    source = "mixed";
  } else if (hasStructured) {
    allSections = [structuredSection as ExtractedSection];
    source = "structured";
  } else if (hasDom) {
    allSections = domSections;
    source = "semantic-dom";
  } else {
    const fallbackText = normalizeText(raw.visibleText);
    allSections = fallbackText ? [{ text: fallbackText, source: "dom" }] : [];
    source = "visible-text";
  }

  let discardedSections = 0;
  if (allSections.length > EXTRACTION_LIMITS.maxSectionCount) {
    discardedSections = allSections.length - EXTRACTION_LIMITS.maxSectionCount;
    allSections = allSections.slice(0, EXTRACTION_LIMITS.maxSectionCount);
    truncatedAnywhere = true;
  }

  allSections = allSections.map((section) => {
    const { text, truncated } = truncate(section.text, EXTRACTION_LIMITS.maxSectionTextChars);
    if (truncated) {
      truncatedAnywhere = true;
    }
    return { ...section, text };
  });

  const combinedText = allSections
    .map((section) => (section.heading ? `${section.heading}\n${section.text}` : section.text))
    .join("\n\n");

  const { text: finalText, truncated: totalTruncated } = truncate(
    combinedText,
    EXTRACTION_LIMITS.maxTotalExtractedChars
  );
  if (totalTruncated) {
    truncatedAnywhere = true;
  }

  const title = jsonLd?.title || raw.ogTitle || raw.documentTitle || "";

  const extracted: ExtractedJobPage = {
    url: raw.url,
    title,
    platform: detectPlatform(raw.url),
    text: finalText,
    sections: allSections,
    metadata: {
      canonicalUrl: raw.canonicalUrl,
      description: raw.metaDescription,
      ogTitle: raw.ogTitle,
      jsonLd,
    },
  };

  return { extracted, diagnostics: { truncated: truncatedAnywhere, discardedSections, source } };
}

/** Section 24: "page accessible but insufficient job content" boundary. */
export function hasMeaningfulContent(extracted: ExtractedJobPage): boolean {
  return extracted.text.trim().length >= MIN_MEANINGFUL_CHARS;
}

export function toJobPage(extracted: ExtractedJobPage): JobPage {
  return {
    url: extracted.url,
    title: extracted.title || undefined,
    text: extracted.text,
    platform: extracted.platform === "unknown" ? undefined : extracted.platform,
  };
}
