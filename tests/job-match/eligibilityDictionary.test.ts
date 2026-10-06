import { describe, expect, it } from "vitest";
import { detectEligibility } from "../../src/job-match/eligibilityDictionary.js";

describe("detectEligibility", () => {
  it("detects all four categories independently", () => {
    const text = [
      "We strongly encourage women and people with disabilities to apply.",
      "Candidates must be authorized to work in this country.",
      "US citizen required.",
      "Active security clearance required.",
    ].join("\n");

    const detected = detectEligibility(text);
    const types = detected.map((d) => d.type).sort();

    expect(types).toEqual([
      "AFFIRMATIVE_PROGRAM",
      "CITIZENSHIP",
      "SECURITY_CLEARANCE",
      "WORK_AUTHORIZATION",
    ]);
  });

  it("does not duplicate a category when two synonyms match the same sentence", () => {
    const detected = detectEligibility("Active security clearance required for this role.");
    const clearanceHits = detected.filter((d) => d.type === "SECURITY_CLEARANCE");
    expect(clearanceHits).toHaveLength(1);
  });

  it("preserves the original source sentence and the exact matched phrase", () => {
    const [warning] = detectEligibility("This role requires US citizen status.");
    expect(warning.source).toBe("This role requires US citizen status.");
    expect(warning.detectedPhrase).toBe("us citizen");
  });

  it("assigns HIGH confidence to explicit legal/administrative requirements", () => {
    const [workAuth] = detectEligibility("Work authorization is required.");
    expect(workAuth.confidence).toBe("HIGH");
  });

  it("assigns MEDIUM confidence to affirmative-program language (context-dependent)", () => {
    const [affirmative] = detectEligibility("This is an affirmative action employer.");
    expect(affirmative.confidence).toBe("MEDIUM");
  });

  it("returns an empty array when no registered phrase is present", () => {
    expect(detectEligibility("We are looking for a backend engineer with Java experience.")).toEqual(
      []
    );
  });
});
