export type JobPlatform =
  | "linkedin"
  | "indeed"
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "gupy"
  | "inhire"
  | "generic"
  | "unknown";

/** Source signal that contributed a section (SDD section 9). */
export type ExtractedSectionSource = "dom" | "metadata";

export interface ExtractedSection {
  heading?: string;
  text: string;
  source: ExtractedSectionSource;
}

export interface ExtractedMetadata {
  canonicalUrl?: string;
  description?: string;
  ogTitle?: string;
  jsonLd?: { title?: string; description?: string };
}

export interface ExtractedJobPage {
  url: string;
  title: string;
  platform: JobPlatform;
  text: string;
  sections: ExtractedSection[];
  metadata: ExtractedMetadata;
}

export type ExtractionSource = "structured" | "semantic-dom" | "visible-text" | "mixed";

export interface ExtractionDiagnostics {
  truncated: boolean;
  discardedSections: number;
  source: ExtractionSource;
}

/** A single heading/paragraph/list-item collected by the content script, pre-DOM-stripping. */
export interface RawElement {
  tag: "H1" | "H2" | "H3" | "H4" | "H5" | "H6" | "P" | "LI";
  text: string;
}

/**
 * Plain, JSON-serializable materials collected by the content script
 * (SDD section 9). Deliberately contains no raw HTML — only already-read
 * text — so it can safely cross the `chrome.tabs.sendMessage` boundary and
 * be fed into a 100% pure, DOM-free extraction pipeline for testing.
 */
export interface RawPageMaterials {
  url: string;
  documentTitle: string;
  canonicalUrl?: string;
  metaDescription?: string;
  ogTitle?: string;
  jsonLdTexts: string[];
  elements: RawElement[];
  visibleText: string;
}
