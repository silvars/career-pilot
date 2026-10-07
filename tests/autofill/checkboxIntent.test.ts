import { describe, expect, it } from "vitest";
import { matchCheckboxIntent } from "../../src/autofill/plan/checkboxIntent.js";

describe("matchCheckboxIntent", () => {
  it("recognizes explicit affirmative words as CHECK", () => {
    expect(matchCheckboxIntent("yes")).toBe("CHECK");
    expect(matchCheckboxIntent("Sim")).toBe("CHECK");
    expect(matchCheckboxIntent(" true ")).toBe("CHECK");
    expect(matchCheckboxIntent("Concordo")).toBe("CHECK");
  });

  it("recognizes explicit negative words as UNCHECK", () => {
    expect(matchCheckboxIntent("no")).toBe("UNCHECK");
    expect(matchCheckboxIntent("Não")).toBe("UNCHECK");
    expect(matchCheckboxIntent("false")).toBe("UNCHECK");
  });

  it("returns undefined (no explicit intent) for a longer sentence, even one containing 'yes'", () => {
    expect(matchCheckboxIntent("Yes, I have experience with that")).toBeUndefined();
  });

  it("returns undefined for undefined/array values", () => {
    expect(matchCheckboxIntent(undefined)).toBeUndefined();
    expect(matchCheckboxIntent(["yes", "no"])).toBeUndefined();
  });
});
