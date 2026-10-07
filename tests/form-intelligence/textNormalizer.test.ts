import { describe, expect, it } from "vitest";
import { humanizeIdentifier, normalizeFieldText } from "../../src/form-intelligence/normalization/textNormalizer.js";

describe("normalizeFieldText", () => {
  it("trims and collapses internal whitespace/newlines", () => {
    expect(normalizeFieldText("  Full   name\n")).toBe("Full name");
  });

  it("returns undefined for undefined, empty or whitespace-only input", () => {
    expect(normalizeFieldText(undefined)).toBeUndefined();
    expect(normalizeFieldText("")).toBeUndefined();
    expect(normalizeFieldText("   \n\t ")).toBeUndefined();
  });
});

describe("humanizeIdentifier", () => {
  it("splits camelCase into words and capitalizes each", () => {
    expect(humanizeIdentifier("currentJobTitle")).toBe("Current Job Title");
  });

  it("splits snake_case and kebab-case into words", () => {
    expect(humanizeIdentifier("expected_salary")).toBe("Expected Salary");
    expect(humanizeIdentifier("work-model")).toBe("Work Model");
  });

  it("returns an empty string for an empty identifier", () => {
    expect(humanizeIdentifier("")).toBe("");
  });
});
