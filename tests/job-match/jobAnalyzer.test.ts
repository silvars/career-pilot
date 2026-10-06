import { describe, expect, it } from "vitest";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import {
  ELIGIBILITY_JOB,
  LANGUAGE_JOB,
  LOCATION_WARNING_JOB,
  STRONG_MATCH_JOB,
} from "../fixtures/jobs.js";

describe("RuleBasedJobAnalyzer", () => {
  const analyzer = new RuleBasedJobAnalyzer();

  it("extracts title, seniority, skills, experience, responsibilities, language and location", async () => {
    const job = await analyzer.analyze({ text: STRONG_MATCH_JOB });

    expect(job.title).toBe("Senior Engineering Manager");
    expect(job.seniority).toBe("Senior Engineering Manager");
    expect(job.requiredSkills).toEqual(
      expect.arrayContaining(["Java", "Spring Boot", "AWS", "Kubernetes", "Microservices"])
    );
    expect(job.preferredSkills).toEqual(expect.arrayContaining(["Kafka", "Docker"]));
    expect(job.requiredExperience).toEqual(
      expect.arrayContaining(["People management experience"])
    );
    expect(job.responsibilities).toEqual(
      expect.arrayContaining([
        "Lead engineering teams and drive architecture decisions",
        "Own technical strategy for distributed systems",
      ])
    );
    expect(job.languages.some((l) => /english/i.test(l))).toBe(true);
    expect(job.location).toBe("Brazil");
  });

  it("extracts work model from free-form text", async () => {
    const job = await analyzer.analyze({ text: LOCATION_WARNING_JOB });
    expect(job.workModel).toBe("Remote");
  });

  it("extracts eligibility requirements with source and confidence preserved", async () => {
    const job = await analyzer.analyze({ text: ELIGIBILITY_JOB });

    expect(job.eligibilityRequirements).toHaveLength(4);
    const types = job.eligibilityRequirements.map((e) => e.type).sort();
    expect(types).toEqual([
      "AFFIRMATIVE_PROGRAM",
      "CITIZENSHIP",
      "SECURITY_CLEARANCE",
      "WORK_AUTHORIZATION",
    ]);
    for (const requirement of job.eligibilityRequirements) {
      expect(requirement.source.length).toBeGreaterThan(0);
      expect(requirement.detectedPhrase.length).toBeGreaterThan(0);
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(requirement.confidence);
    }
  });

  it("does not misclassify a language-requirement sentence without a known language name", async () => {
    const job = await analyzer.analyze({ text: LANGUAGE_JOB });
    expect(job.languages).toHaveLength(2);
  });

  it("throws JOB_PAGE_NOT_READABLE for an empty page", async () => {
    await expect(analyzer.analyze({ text: "" })).rejects.toMatchObject({
      code: "JOB_PAGE_NOT_READABLE",
    });
  });

  it("throws JOB_REQUIREMENTS_NOT_FOUND when only a bare title can be extracted", async () => {
    await expect(
      analyzer.analyze({ text: "Some Random Job Title With No Other Content" })
    ).rejects.toMatchObject({ code: "JOB_REQUIREMENTS_NOT_FOUND" });
  });

  it("prefers JobPage.title over the first text line when provided", async () => {
    const job = await analyzer.analyze({
      title: "Explicit Title",
      text: "Some other first line\n\nRequirements:\n- Java\n",
    });
    expect(job.title).toBe("Explicit Title");
  });
});
