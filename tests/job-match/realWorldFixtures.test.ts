import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FsProfileLoader } from "../../src/profile/profileLoader.js";
import type { Profile } from "../../src/profile/types.js";
import { buildExtractedJobPage, hasMeaningfulContent, toJobPage } from "../../src/extension/job-extraction/extractor.js";
import { detectPlatform } from "../../src/extension/job-extraction/platformDetector.js";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import { RuleBasedMatchEngine } from "../../src/job-match/matchEngine.js";
import type { RawPageMaterials } from "../../src/extension/job-extraction/types.js";
import { CANONICAL_RAW_MATERIALS } from "../fixtures/pages/canonical.js";
import { ARCO_EDUCACAO_RAW_MATERIALS } from "../fixtures/pages/arcoEducacao.js";
import { C6_BANK_RAW_MATERIALS } from "../fixtures/pages/c6bank.js";

/**
 * Regression suite for real postings the user provided (2026-10-07) as
 * future test material, beyond the already-covered Akad/InHire fixture.
 * Exercises three more platforms/languages/domains in one pass: Greenhouse
 * EN (Canonical, open-source infra), Greenhouse pt-BR edtech (Arco), and
 * Greenhouse pt-BR fintech/AI (C6 Bank). Each surfaced new real header
 * phrasing gaps that are now fixed in jobAnalyzer.ts (substring header
 * matching + a few curated entries).
 */
const FIXTURES: Array<{ name: string; raw: RawPageMaterials }> = [
  { name: "Canonical (Greenhouse, EN)", raw: CANONICAL_RAW_MATERIALS },
  { name: "Arco Educação (Greenhouse, pt-BR)", raw: ARCO_EDUCACAO_RAW_MATERIALS },
  { name: "C6 Bank (Greenhouse, pt-BR)", raw: C6_BANK_RAW_MATERIALS },
];

describe("real-world fixtures (Greenhouse postings, 2026-10-07)", () => {
  it.each(FIXTURES)("detects the Greenhouse platform for $name", ({ raw }) => {
    expect(detectPlatform(raw.url)).toBe("greenhouse");
  });

  it.each(FIXTURES)("produces meaningful extracted content for $name", ({ raw }) => {
    const { extracted } = buildExtractedJobPage(raw);
    expect(hasMeaningfulContent(extracted)).toBe(true);
  });

  it.each(FIXTURES)(
    "does not collapse to title-only: at least one of required/preferred/responsibilities is populated for $name",
    async ({ raw }) => {
      const { extracted } = buildExtractedJobPage(raw);
      const job = await new RuleBasedJobAnalyzer().analyze(toJobPage(extracted));

      const totalRequirementSignals =
        job.requiredSkills.length +
        job.preferredSkills.length +
        job.requiredExperience.length +
        job.responsibilities.length;
      expect(totalRequirementSignals).toBeGreaterThan(0);
    }
  );

  describe("end-to-end Match Engine run against the real rodrigo-matos profile", () => {
    let profile: Profile;

    beforeAll(async () => {
      const vendorRoot = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "vendor",
        "profiles"
      );
      profile = await new FsProfileLoader(vendorRoot).loadProfile("rodrigo-matos");
    });

    it.each(FIXTURES)("produces a plausible, evidence-backed MatchResult for $name", async ({ raw }) => {
      const { extracted } = buildExtractedJobPage(raw);
      const job = await new RuleBasedJobAnalyzer().analyze(toJobPage(extracted));
      const result = await new RuleBasedMatchEngine().evaluate(job, profile);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(["STRONG_MATCH", "GOOD_MATCH", "PARTIAL_MATCH", "LOW_MATCH"]).toContain(result.recommendation);

      // No hallucination (SDD section 14): every MATCHED/PARTIAL requirement
      // must carry real evidence, every MISSING must carry none.
      for (const requirement of [...result.matchedRequirements, ...result.partialRequirements]) {
        expect(requirement.evidence.length).toBeGreaterThan(0);
      }
      for (const requirement of result.missingRequirements) {
        expect(requirement.evidence).toEqual([]);
      }
    });
  });
});
