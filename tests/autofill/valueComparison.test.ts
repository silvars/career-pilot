import { describe, expect, it } from "vitest";
import { normalizeForComparison, valuesMatch } from "../../src/autofill/execute/valueComparison.js";

describe("normalizeForComparison", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeForComparison("  Rodrigo Matos  ")).toBe("rodrigo matos");
  });

  it("lowercases", () => {
    expect(normalizeForComparison("REMOTE")).toBe("remote");
  });
});

describe("valuesMatch", () => {
  it("matches identical values", () => {
    expect(valuesMatch("Remote", "Remote")).toBe(true);
  });

  it("matches values differing only by case", () => {
    expect(valuesMatch("Remote", "remote")).toBe(true);
  });

  it("matches values differing only by surrounding whitespace (common after a browser autofill/re-render round trip)", () => {
    expect(valuesMatch("Rodrigo Matos", "  Rodrigo Matos ")).toBe(true);
  });

  it("does not match genuinely different values", () => {
    expect(valuesMatch("Remote", "Hybrid")).toBe(false);
  });

  it("does not match an empty actual value against a non-empty expected value (fill silently rejected by the page)", () => {
    expect(valuesMatch("Remote", "")).toBe(false);
  });
});
