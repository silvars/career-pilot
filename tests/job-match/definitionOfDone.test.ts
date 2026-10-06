import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsProfileLoader } from "../../src/profile/profileLoader.js";
import { DefaultProfileManager } from "../../src/profile/profileManager.js";
import { FixtureJobPageSource } from "../../src/job-match/jobPageSource.js";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import { RuleBasedMatchEngine } from "../../src/job-match/matchEngine.js";
import { STRONG_MATCH_JOB } from "../fixtures/jobs.js";

const vendorRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "vendor",
  "profiles"
);

describe("Definition of Done — Job Match logic (SDD section 41)", () => {
  it("runs the full JobPageSource -> JobAnalyzer -> MatchEngine flow using FixtureJobPageSource, no Chrome involved", async () => {
    const profileManager = new DefaultProfileManager(new FsProfileLoader(vendorRoot));
    const profile = await profileManager.load("rodrigo-matos");

    const jobPageSource = new FixtureJobPageSource({ text: STRONG_MATCH_JOB });
    const jobAnalyzer = new RuleBasedJobAnalyzer();
    const matchEngine = new RuleBasedMatchEngine();

    const currentJobPage = await jobPageSource.getCurrentJobPage();
    const job = await jobAnalyzer.analyze(currentJobPage);
    const match = await matchEngine.evaluate(job, profile);

    expect(match).toMatchObject({
      recommendation: expect.any(String),
      profileId: "rodrigo-matos",
    });
    expect(typeof match.score).toBe("number");
    expect(match.score).toBeGreaterThanOrEqual(0);
    expect(match.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(match.matchedRequirements)).toBe(true);
    expect(Array.isArray(match.partialRequirements)).toBe(true);
    expect(Array.isArray(match.missingRequirements)).toBe(true);
    expect(Array.isArray(match.unclearRequirements)).toBe(true);
    expect(Array.isArray(match.eligibilityWarnings)).toBe(true);
    expect(Array.isArray(match.evidence)).toBe(true);

    // Deterministic in V1 (SDD section 41): re-running must yield the same result.
    const matchAgain = await matchEngine.evaluate(job, profile);
    expect(matchAgain.score).toBe(match.score);
    expect(matchAgain.recommendation).toBe(match.recommendation);
  });
});
