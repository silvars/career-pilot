import { describe, expect, it } from "vitest";
import { extractSkills } from "../../src/job-match/skillVocabulary.js";

describe("extractSkills", () => {
  it("extracts multiple distinct skills from a comma-separated line", () => {
    expect(extractSkills("Java, Spring Boot, AWS, Kubernetes")).toEqual(
      expect.arrayContaining(["Java", "Spring Boot", "AWS", "Kubernetes"])
    );
  });

  it("does not double-count a shorter term contained in a longer matched term", () => {
    const skills = extractSkills("Spring Boot experience required");
    expect(skills).toContain("Spring Boot");
    expect(skills).not.toContain("Spring");
  });

  it("still finds a standalone short term when the longer variant is absent", () => {
    expect(extractSkills("Spring experience required")).toEqual(["Spring"]);
  });

  it("returns an empty array when no vocabulary term is present", () => {
    expect(extractSkills("Excellent communication skills")).toEqual([]);
  });

  it("does not match a vocabulary term as a substring of an unrelated word", () => {
    // "Java" must not match inside "Javascript".
    expect(extractSkills("Javascript experience")).toEqual([]);
  });
});
