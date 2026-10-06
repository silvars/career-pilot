import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsProfileLoader } from "../../src/profile/profileLoader.js";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import { RuleBasedMatchEngine } from "../../src/job-match/matchEngine.js";

const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "profiles"
);

describe("Job Match profile isolation", () => {
  it("only evaluates against the active profile and never mixes evidence across profiles", async () => {
    const loader = new FsProfileLoader(fixturesRoot);
    const profileA = await loader.loadProfile("profile-a"); // has Java
    const profileB = await loader.loadProfile("profile-b"); // has no Java

    const analyzer = new RuleBasedJobAnalyzer();
    const engine = new RuleBasedMatchEngine();
    const job = await analyzer.analyze({
      text: "Backend Engineer\n\nRequirements:\n- Java\n",
    });

    const resultA = await engine.evaluate(job, profileA);
    const resultB = await engine.evaluate(job, profileB);

    expect(resultA.profileId).toBe("profile-a");
    const javaA = resultA.matchedRequirements.find((r) => r.requirement === "Java");
    expect(javaA).toBeDefined();
    expect(javaA!.evidence.every((e) => e.profileId === "profile-a")).toBe(true);

    expect(resultB.profileId).toBe("profile-b");
    const javaB = resultB.missingRequirements.find((r) => r.requirement === "Java");
    expect(javaB).toBeDefined();
    expect(javaB!.evidence).toEqual([]);
  });
});
