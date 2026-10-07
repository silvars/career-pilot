/**
 * Deterministic regex extraction from already-retrieved profile chunk
 * text (SDD "Form Intelligence" sections 5/7: never a second retrieval
 * mechanism, never invented — only read out a canonical fact that is
 * *literally written* in the profile). Every function returns `undefined`
 * (never throws, never guesses) when the expected pattern isn't present.
 */

const EMAIL_PATTERN = /^-\s*Email:\s*(\S+)/im;
const LINKEDIN_PATTERN = /^-\s*LinkedIn:\s*(\S+)/im;
const GITHUB_PATTERN = /^-\s*GitHub:\s*(\S+)/im;
const PORTFOLIO_PATTERN = /^-\s*(?:Personal site|Portfolio|Website):\s*(\S+)/im;
const LOCATION_PATTERN = /^-\s*City:\s*(.+)$/im;
const NAME_PATTERN = /^-\s*Name:\s*(.+)$/im;
/** Real canonical field found in identity/career-objectives.md ("Current role (for applications)"), purpose-built for exactly this use case. */
const CURRENT_TITLE_PATTERN = /^-\s*current_title:\s*(.+)$/im;

/**
 * SDD "Local Semantic Retrieval" rule carried over verbatim: only an
 * explicit "20+ years"-style statement counts — never computed from career
 * dates. Requires the "+" so a tenure-specific mention like "2 years at X"
 * (no "+") is never mistaken for a total-experience claim.
 */
const EXPLICIT_YEARS_PATTERN = /\b(\d{1,2}\+\s*years?)\b/i;

function extract(content: string, pattern: RegExp): string | undefined {
  return content.match(pattern)?.[1]?.trim();
}

export function extractEmail(content: string): string | undefined {
  return extract(content, EMAIL_PATTERN);
}

export function extractLinkedIn(content: string): string | undefined {
  return extract(content, LINKEDIN_PATTERN);
}

export function extractGitHub(content: string): string | undefined {
  return extract(content, GITHUB_PATTERN);
}

export function extractPortfolio(content: string): string | undefined {
  return extract(content, PORTFOLIO_PATTERN);
}

export function extractLocation(content: string): string | undefined {
  return extract(content, LOCATION_PATTERN);
}

export function extractFullName(content: string): string | undefined {
  return extract(content, NAME_PATTERN);
}

export function extractExplicitYearsOfExperience(content: string): string | undefined {
  return content.match(EXPLICIT_YEARS_PATTERN)?.[1]?.trim();
}

export function extractCurrentJobTitle(content: string): string | undefined {
  return extract(content, CURRENT_TITLE_PATTERN);
}

