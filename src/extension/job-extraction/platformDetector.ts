import type { JobPlatform } from "./types.js";

const HOSTNAME_RULES: Array<{ platform: JobPlatform; pattern: RegExp }> = [
  { platform: "linkedin", pattern: /(^|\.)linkedin\.com$/i },
  { platform: "indeed", pattern: /(^|\.)indeed\.com$/i },
  { platform: "greenhouse", pattern: /(^|\.)greenhouse\.io$/i },
  { platform: "lever", pattern: /(^|\.)lever\.co$/i },
  { platform: "workday", pattern: /\.myworkday\.com$/i },
  { platform: "ashby", pattern: /(^|\.)ashbyhq\.com$/i },
  { platform: "gupy", pattern: /(^|\.)gupy\.io$/i },
  { platform: "inhire", pattern: /(^|\.)inhire\.app$/i },
];

/** Detection uses hostname/URL patterns, never the page title alone (SDD section 13). */
export function detectPlatform(url: string): JobPlatform {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return "unknown";
  }

  for (const { platform, pattern } of HOSTNAME_RULES) {
    if (pattern.test(hostname)) {
      return platform;
    }
  }
  return "generic";
}

const UNSUPPORTED_HOSTS = new Set(["chrome.google.com", "chromewebstore.google.com"]);

/**
 * Every http(s) page is supported for generic extraction (SDD section 14.1)
 * except the few hosts that are never job pages. Browser-internal schemes
 * (chrome://, chrome-extension://, edge://, about:, devtools://, ...) are
 * rejected implicitly by requiring http/https.
 */
export function isSupportedPageUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  return !UNSUPPORTED_HOSTS.has(parsed.hostname);
}
