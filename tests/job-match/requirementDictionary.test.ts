import { describe, expect, it } from "vitest";
import { normalizeRequirement } from "../../src/job-match/requirementDictionary.js";

describe("normalizeRequirement", () => {
  it("normalizes a registered synonym to the concept's canonical phrase", () => {
    const result = normalizeRequirement("Strong team leadership skills required");
    expect(result.concept).toBe("peopleManagement");
    expect(result.canonicalQuery).toBe("people management");
    expect(result.original).toBe("Strong team leadership skills required");
  });

  it("normalizes engineering-management synonyms", () => {
    expect(normalizeRequirement("Proven engineering leadership track record").concept).toBe(
      "engineeringManagement"
    );
  });

  it("normalizes distributed-systems synonyms", () => {
    expect(normalizeRequirement("Experience with distributed architecture").concept).toBe(
      "distributedSystems"
    );
  });

  it("passes unregistered text through unchanged (no ontology/NLP)", () => {
    const result = normalizeRequirement("Experience with watercolor painting");
    expect(result.concept).toBeUndefined();
    expect(result.canonicalQuery).toBe("Experience with watercolor painting");
  });
});
