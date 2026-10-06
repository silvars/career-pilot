/** Closed for FASE 4 (SDD decision 1.1) — do not change without updating the SDD and its tests. */
export const EXTRACTION_LIMITS = {
  maxTotalExtractedChars: 20000,
  maxSectionCount: 50,
  maxSectionTextChars: 4000,
  maxJsonLdBytes: 50000,
} as const;
