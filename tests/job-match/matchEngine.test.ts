import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FsProfileLoader } from "../../src/profile/profileLoader.js";
import type { Profile } from "../../src/profile/types.js";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import { RuleBasedMatchEngine } from "../../src/job-match/matchEngine.js";
import { buildExtractedJobPage, toJobPage } from "../../src/extension/job-extraction/extractor.js";
import { AKAD_INHIRE_RAW_MATERIALS } from "../fixtures/pages/akadInhire.js";
import {
  BASELINE_NO_ELIGIBILITY_JOB,
  ELIGIBILITY_JOB,
  GOOD_MATCH_JOB,
  LANGUAGE_JOB,
  LOCATION_WARNING_JOB,
  LOW_MATCH_JOB,
  MISSING_REQUIRED_SKILL_JOB,
  PARTIAL_MATCH_JOB,
  SENIORITY_MISMATCH_JOB,
  STRONG_MATCH_JOB,
} from "../fixtures/jobs.js";

const vendorRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "vendor",
  "profiles"
);

describe("RuleBasedMatchEngine against the real rodrigo-matos profile", () => {
  let profile: Profile;
  const analyzer = new RuleBasedJobAnalyzer();
  const engine = new RuleBasedMatchEngine();

  beforeAll(async () => {
    const loader = new FsProfileLoader(vendorRoot);
    profile = await loader.loadProfile("rodrigo-matos");
  });

  async function evaluate(jobText: string) {
    const job = await analyzer.analyze({ text: jobText });
    return engine.evaluate(job, profile);
  }

  it("produces a STRONG_MATCH for a closely aligned job", async () => {
    const result = await evaluate(STRONG_MATCH_JOB);
    expect(result.recommendation).toBe("STRONG_MATCH");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("produces a GOOD_MATCH when some required items are missing", async () => {
    const result = await evaluate(GOOD_MATCH_JOB);
    expect(result.recommendation).toBe("GOOD_MATCH");
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.score).toBeLessThan(90);
  });

  it("produces a PARTIAL_MATCH for a loosely related job", async () => {
    const result = await evaluate(PARTIAL_MATCH_JOB);
    expect(result.recommendation).toBe("PARTIAL_MATCH");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(75);
  });

  it("produces a LOW_MATCH for an unrelated domain", async () => {
    const result = await evaluate(LOW_MATCH_JOB);
    expect(result.recommendation).toBe("LOW_MATCH");
    expect(result.score).toBeLessThan(60);
  });

  it("flags a missing required skill regardless of the overall score", async () => {
    const result = await evaluate(MISSING_REQUIRED_SKILL_JOB);
    const terraform = result.missingRequirements.find((r) => r.requirement === "Terraform");
    expect(terraform).toBeDefined();
    expect(terraform?.type).toBe("REQUIRED_SKILL");
    expect(terraform?.evidence).toEqual([]);
  });

  it("detects a partial skill/experience match distinct from a full match", async () => {
    const result = await evaluate(PARTIAL_MATCH_JOB);
    const partial = result.partialRequirements.find((r) => r.requirement === "Snowflake data modeling");
    expect(partial).toBeDefined();
    expect(partial!.score).toBeGreaterThan(0);
    expect(partial!.score).toBeLessThan(85);
  });

  it("flags a seniority mismatch as MISSING", async () => {
    const result = await evaluate(SENIORITY_MISMATCH_JOB);
    const seniority = result.missingRequirements.find((r) => r.type === "SENIORITY");
    expect(seniority).toBeDefined();
    expect(seniority?.requirement).toBe("Junior");
  });

  it("treats a 'native' language requirement as UNCLEAR when the profile only states a proficiency level", async () => {
    const result = await evaluate(LANGUAGE_JOB);
    const english = result.unclearRequirements.find((r) => /english/i.test(r.requirement));
    expect(english).toBeDefined();
    expect(english?.type).toBe("LANGUAGE");
  });

  it("flags a language the profile never mentions as MISSING", async () => {
    const result = await evaluate(LANGUAGE_JOB);
    const german = result.missingRequirements.find((r) => /german/i.test(r.requirement) && r.type === "LANGUAGE");
    expect(german).toBeDefined();
  });

  it("flags an unconfirmed work model as MISSING without assuming eligibility", async () => {
    const result = await evaluate(LOCATION_WARNING_JOB);
    const workModel = result.missingRequirements.find((r) => r.type === "WORK_MODEL");
    expect(workModel).toBeDefined();
    expect(workModel?.requirement).toBe("Remote");
  });

  describe("Eligibility separation (SDD sections 20-21)", () => {
    it("never classifies eligibility text as a scored requirement type", async () => {
      const result = await evaluate(ELIGIBILITY_JOB);
      const allRequirements = [
        ...result.matchedRequirements,
        ...result.partialRequirements,
        ...result.missingRequirements,
        ...result.unclearRequirements,
      ];
      expect(allRequirements.every((r) => r.type !== "ELIGIBILITY")).toBe(true);
    });

    it("surfaces eligibility warnings separately from the scored requirements", async () => {
      const result = await evaluate(ELIGIBILITY_JOB);
      expect(result.eligibilityWarnings.length).toBe(4);
    });

    it("does not change the Career Match Score when eligibility text is present", async () => {
      const withoutEligibility = await evaluate(BASELINE_NO_ELIGIBILITY_JOB);
      const withEligibility = await evaluate(ELIGIBILITY_JOB);
      expect(withEligibility.score).toBe(withoutEligibility.score);
      expect(withEligibility.recommendation).toBe(withoutEligibility.recommendation);
    });
  });

  describe("No hallucination (SDD section 14)", () => {
    it("never attaches evidence to a MISSING requirement", async () => {
      const result = await evaluate(LOW_MATCH_JOB);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
      for (const requirement of result.missingRequirements) {
        expect(requirement.evidence).toEqual([]);
      }
    });

    it("every MATCHED/PARTIAL requirement's evidence points to real profile chunks", async () => {
      const result = await evaluate(STRONG_MATCH_JOB);
      for (const requirement of [...result.matchedRequirements, ...result.partialRequirements]) {
        expect(requirement.evidence.length).toBeGreaterThan(0);
        for (const evidence of requirement.evidence) {
          expect(evidence.profileId).toBe("rodrigo-matos");
          expect(evidence.path.length).toBeGreaterThan(0);
          expect(evidence.chunkId.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("pt-BR <-> EN requirement normalization (real finding, 2026-10-06 — Akad/InHire)", () => {
    it("scores the real Akad/InHire posting higher than the pre-normalizer baseline (61), with traceable evidence and no fabricated matches", async () => {
      const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);
      const job = await analyzer.analyze(toJobPage(extracted));
      const result = await engine.evaluate(job, profile);

      // Baseline (English-only retrieval, before this normalizer) was 61 —
      // TITLE/SENIORITY matched, everything else MISSING purely from
      // language mismatch. More real pt-BR requirements must now resolve to
      // MATCHED/PARTIAL instead of a false MISSING.
      expect(result.score).toBeGreaterThan(61);
      expect(result.matchedRequirements.length + result.partialRequirements.length).toBeGreaterThan(2);

      // No hallucination: every non-MISSING requirement still carries real
      // evidence pointing at actual profile chunks (SDD section 14).
      for (const requirement of [...result.matchedRequirements, ...result.partialRequirements]) {
        expect(requirement.evidence.length).toBeGreaterThan(0);
        for (const evidence of requirement.evidence) {
          expect(evidence.profileId).toBe("rodrigo-matos");
        }
      }

      // The people-management requirement (pt-BR: "gerenciando pessoas" /
      // "feedback, 1:1s e desenvolvimento de carreira") must no longer be a
      // false MISSING — the profile explicitly lists this capability in English.
      const peopleManagement = [...result.matchedRequirements, ...result.partialRequirements].find((r) =>
        /gerenciando pessoas/i.test(r.requirement)
      );
      expect(peopleManagement).toBeDefined();
    });

    it("FASE 5.5 hardening: the real pt-BR phrasings for process-simplification/business-outcomes/technical-proximity are no longer false MISSING", async () => {
      const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);
      const job = await analyzer.analyze(toJobPage(extracted));
      const result = await engine.evaluate(job, profile);

      const missingLabels = result.missingRequirements.map((r) => r.requirement);
      expect(missingLabels.some((r) => /simplificar processos|bloqueios organizacionais/i.test(r))).toBe(false);
      expect(missingLabels.some((r) => /resultado de neg[oó]cio/i.test(r))).toBe(false);
      expect(missingLabels.some((r) => /pr[oó]ximo da tecnologia/i.test(r))).toBe(false);
    });
  });

  describe("FASE 5.5 hardening — the 4 documented false negatives (SDD section 40.1 / FASE 4.1 benchmark)", () => {
    // Real root cause (measured, not assumed): RequirementNormalizer had no
    // concept entry at all for these 4 topics, so bestAcrossVariants only
    // ever tried the literal requirement text as its single query — adding
    // EN/PT-BR phrasings closer to the profile's actual wording is strictly
    // additive (more query variants), no scoring/threshold/weight change.
    const job = `Senior Engineering Manager

Responsibilities:
- Comfortable with autonomy and ownership
- Focus on reducing bureaucracy and simplifying processes
- Strong focus on measurable business outcomes
- Stays technically close to the team
`;

    it("none of the 4 requirements are MISSING against the real profile (plain KeywordRetriever, no embeddings needed)", async () => {
      const result = await evaluate(job);

      const missingLabels = result.missingRequirements.map((r) => r.requirement);
      expect(missingLabels).toEqual([]);

      const evaluated = [...result.matchedRequirements, ...result.partialRequirements];
      expect(evaluated.length).toBeGreaterThanOrEqual(4);
      for (const requirement of evaluated) {
        expect(requirement.evidence.length).toBeGreaterThan(0);
      }
    });
  });
});
