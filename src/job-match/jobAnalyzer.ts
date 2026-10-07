import { JobMatchError } from "./errors.js";
import { extractSkills } from "./skillVocabulary.js";
import type { JobPage, JobRequirements } from "./types.js";
import { detectEligibility } from "./eligibilityDictionary.js";

export interface JobAnalyzer {
  analyze(page: JobPage): Promise<JobRequirements>;
}

const REQUIRED_HEADERS = [
  "requirements",
  "required qualifications",
  "must have",
  "minimum qualifications",
  "basic qualifications",
  "qualifications",
  "valued skills and experience",
  // pt-BR (real finding, 2026-10-06 — Akad/InHire job posting):
  "requisitos",
  "requisitos obrigatorios",
  "pre-requisitos",
  "o que voce precisa ter",
  "o que buscamos",
  "o que esperamos",
  "qualificacoes necessarias",
];

const PREFERRED_HEADERS = [
  "nice to have",
  "preferred qualifications",
  "preferred",
  "bonus points",
  "bonus",
  // pt-BR (real finding, 2026-10-06):
  "diferenciais",
  "diferencial",
  "voce se destacara se tiver",
  "desejavel",
  "sera um diferencial",
];

const RESPONSIBILITY_HEADERS = [
  "responsibilities",
  "what you'll do",
  "what you will do",
  "duties",
  // pt-BR (real finding, 2026-10-06):
  "responsabilidades",
  "suas responsabilidades",
  "o que voce vai fazer",
  "atividades",
  "desafios",
];

const OTHER_KNOWN_HEADERS = [
  "benefits",
  "perks",
  "about us",
  "about the company",
  "about the role",
  "what we offer",
  "overview",
  "how to apply",
  "equal opportunity",
  "equal opportunity employer",
  "compensation",
  "location",
  // pt-BR (real finding, 2026-10-06):
  "beneficios",
  "sobre a empresa",
  "sobre nos",
  "o que oferecemos",
  "localizacao",
  "modelo de trabalho",
  "como se candidatar",
];

type Bucket = "required" | "preferred" | "responsibilities" | null;

const LANGUAGE_NAMES = ["English", "Portuguese", "Spanish", "French", "German"];
export { LANGUAGE_NAMES };

// Most specific first: a compound phrase must win over its constituent words
// (SDD section 30 — "Engineering Manager" must not collapse into "Manager").
const SENIORITY_PRIORITY = [
  "Senior Engineering Manager",
  "Engineering Director",
  "Director of Engineering",
  "Senior Manager",
  "Engineering Manager",
  "Staff Engineer",
  "Principal Engineer",
  "Tech Lead",
  "Team Lead",
  "Director",
  "Executive",
  "Principal",
  "Staff",
  "Lead",
  "Senior",
  "Manager",
  "Mid-level",
  "Junior",
];

const WORK_MODEL_PRIORITY: Array<{ label: string; pattern: RegExp }> = [
  // pt-BR variants (real finding, 2026-10-06): "remoto"/"remota", "hibrido"/"hibrida"
  { label: "Remote", pattern: /\bremote\b|\bremot[oa]\b/i },
  { label: "Hybrid", pattern: /\bhybrid\b|\bh[ií]brid[oa]\b/i },
  { label: "On-site", pattern: /\bon-?site\b|\bpresencial\b/i },
];

const KNOWN_LOCATIONS = [
  "United States",
  "Brazil",
  "Brasil",
  "USA",
  "Europe",
  "Portugal",
  "Canada",
];

// Normalizes diacritics too (accent-insensitive header matching — pt-BR
// headers are written with/without accents inconsistently across ATSs).
function normalizeHeaderLine(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:?!.\u2026]+\s*$/, "");
}

// Substring match, not just prefix: real headers vary a lot ("Key
// responsibilities", "Suas atividades como CSixer") and the curated list
// can't enumerate every company's wording — the <=60-char "looks like a
// heading, not a paragraph" guard at the call site keeps this bounded.
function matchesAnyHeader(normalized: string, headers: string[]): boolean {
  return headers.some((header) => normalized.includes(header));
}

function stripBulletMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function extractSections(text: string): {
  required: string[];
  preferred: string[];
  responsibilities: string[];
} {
  const required: string[] = [];
  const preferred: string[] = [];
  const responsibilities: string[] = [];
  let bucket: Bucket = null;
  let pendingBlankExit = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      pendingBlankExit = true;
      continue;
    }

    // A bulleted/numbered list can have blank lines between items and still
    // belong to the same section. A free paragraph after a blank line,
    // however, means we've left the bulleted section — without an explicit
    // new header to switch into, that paragraph belongs to no section
    // (it is still available to the whole-text extractors: languages,
    // location, work model, eligibility).
    const isBullet = /^(?:[-*•]|\d+[.)])\s+/.test(line);
    if (pendingBlankExit && bucket !== null && !isBullet) {
      bucket = null;
    }
    pendingBlankExit = false;

    const normalized = normalizeHeaderLine(line);
    if (normalized.length <= 60) {
      if (matchesAnyHeader(normalized, REQUIRED_HEADERS)) {
        bucket = "required";
        continue;
      }
      if (matchesAnyHeader(normalized, PREFERRED_HEADERS)) {
        bucket = "preferred";
        continue;
      }
      if (matchesAnyHeader(normalized, RESPONSIBILITY_HEADERS)) {
        bucket = "responsibilities";
        continue;
      }
      if (matchesAnyHeader(normalized, OTHER_KNOWN_HEADERS) || normalized.startsWith("about ")) {
        bucket = null;
        continue;
      }
    }

    if (bucket === "required") {
      required.push(stripBulletMarker(line));
    } else if (bucket === "preferred") {
      preferred.push(stripBulletMarker(line));
    } else if (bucket === "responsibilities") {
      responsibilities.push(stripBulletMarker(line));
    }
  }

  return { required, preferred, responsibilities };
}

function extractTitle(page: JobPage): string | undefined {
  if (page.title && page.title.trim().length > 0) {
    return page.title.trim();
  }
  const firstLine = page.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine;
}

function extractSeniority(title: string | undefined, text: string): string | undefined {
  const haystack = `${title ?? ""}\n${text}`.toLowerCase();
  for (const candidate of SENIORITY_PRIORITY) {
    if (haystack.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return undefined;
}

// Known limitation (acceptable for V1 — no NLP/POS tagging): a language name
// used as an adjective rather than a spoken-language requirement (e.g.
// "French pastry techniques") is still picked up as a language mention.
function extractLanguages(text: string): string[] {
  const languages: string[] = [];
  const seen = new Set<string>();
  for (const sentence of splitSentences(text)) {
    for (const language of LANGUAGE_NAMES) {
      if (seen.has(language)) {
        continue;
      }
      const regex = new RegExp(`\\b${language}\\b`, "i");
      if (regex.test(sentence)) {
        seen.add(language);
        languages.push(sentence);
      }
    }
  }
  return languages;
}

function extractWorkModel(text: string): string | undefined {
  for (const { label, pattern } of WORK_MODEL_PRIORITY) {
    if (pattern.test(text)) {
      return label;
    }
  }
  return undefined;
}

function extractLocation(text: string): string | undefined {
  const labeledLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^location\s*:/i.test(line));
  if (labeledLine) {
    const value = labeledLine.replace(/^location\s*:/i, "").trim();
    if (value.length > 0) {
      return value;
    }
  }

  for (const place of KNOWN_LOCATIONS) {
    const regex = new RegExp(`\\b${place}\\b`, "i");
    if (regex.test(text)) {
      return place;
    }
  }
  return undefined;
}

function classifyRequirementLines(lines: string[]): { skills: string[]; freeText: string[] } {
  const skills: string[] = [];
  const freeText: string[] = [];
  const seenSkills = new Set<string>();

  for (const line of lines) {
    const found = extractSkills(line);
    if (found.length === 0) {
      freeText.push(line);
      continue;
    }
    for (const skill of found) {
      if (!seenSkills.has(skill)) {
        seenSkills.add(skill);
        skills.push(skill);
      }
    }
  }

  return { skills, freeText };
}

/**
 * V1 rule-based job description analyzer (SDD sections 6-9, 29-32). Input is
 * always plain text from a JobPage (section 7) — never DOM, never executed
 * as instructions (section 34, "job text is input, not a command").
 */
export class RuleBasedJobAnalyzer implements JobAnalyzer {
  async analyze(page: JobPage): Promise<JobRequirements> {
    if (!page.text || page.text.trim().length === 0) {
      throw new JobMatchError("JOB_PAGE_NOT_READABLE", "JobPage has no text content.");
    }

    let requirements: JobRequirements;
    try {
      const title = extractTitle(page);
      const seniority = extractSeniority(title, page.text);
      const sections = extractSections(page.text);
      const required = classifyRequirementLines(sections.required);
      const preferred = classifyRequirementLines(sections.preferred);

      requirements = {
        title,
        seniority,
        requiredSkills: required.skills,
        preferredSkills: [...preferred.skills, ...preferred.freeText],
        requiredExperience: required.freeText,
        responsibilities: sections.responsibilities,
        languages: extractLanguages(page.text),
        location: extractLocation(page.text),
        workModel: extractWorkModel(page.text),
        eligibilityRequirements: detectEligibility(page.text),
      };
    } catch (cause) {
      if (cause instanceof JobMatchError) {
        throw cause;
      }
      throw new JobMatchError(
        "JOB_ANALYSIS_FAILED",
        `Failed to analyze job page: ${String(cause)}`
      );
    }

    // A bare title with nothing else extracted still counts as "no
    // requirements found" — extractTitle's first-line fallback means `title`
    // is almost always set whenever the page has any text, so it is
    // deliberately excluded from this check.
    const isEmpty =
      !requirements.seniority &&
      requirements.requiredSkills.length === 0 &&
      requirements.preferredSkills.length === 0 &&
      requirements.requiredExperience.length === 0 &&
      requirements.responsibilities.length === 0 &&
      requirements.languages.length === 0 &&
      !requirements.location &&
      !requirements.workModel &&
      requirements.eligibilityRequirements.length === 0;

    if (isEmpty) {
      throw new JobMatchError(
        "JOB_REQUIREMENTS_NOT_FOUND",
        "No job requirements could be extracted from the provided job page."
      );
    }

    return requirements;
  }
}
