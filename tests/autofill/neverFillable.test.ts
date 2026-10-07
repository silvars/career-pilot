import { describe, expect, it } from "vitest";
import { isNeverFillable } from "../../src/autofill/execute/neverFillable.js";

describe("isNeverFillable", () => {
  it("blocks password fields regardless of name/id", () => {
    expect(isNeverFillable({ inputType: "password", name: "currentPassword" })).toBe(true);
  });

  it("blocks fields with a standard payment autocomplete token (cc-number, cc-exp, cc-csc, ...)", () => {
    expect(isNeverFillable({ inputType: "text", autocomplete: "cc-number" })).toBe(true);
    expect(isNeverFillable({ inputType: "text", autocomplete: "cc-exp" })).toBe(true);
  });

  it("autocomplete token match is case-insensitive", () => {
    expect(isNeverFillable({ inputType: "text", autocomplete: "CC-NUMBER" })).toBe(true);
  });

  it("blocks fields whose name/id contains a curated payment keyword", () => {
    expect(isNeverFillable({ inputType: "text", name: "card_number" })).toBe(true);
    expect(isNeverFillable({ inputType: "text", id: "cvv" })).toBe(true);
    expect(isNeverFillable({ inputType: "text", name: "bankRoutingNumber" })).toBe(true);
  });

  it("allows ordinary text fields with no password/payment signal", () => {
    expect(isNeverFillable({ inputType: "text", name: "fullName", id: "fullName" })).toBe(false);
  });

  it("allows fields with an unrelated autocomplete token", () => {
    expect(isNeverFillable({ inputType: "email", autocomplete: "email" })).toBe(false);
  });

  it("allows fields with no descriptor data at all", () => {
    expect(isNeverFillable({})).toBe(false);
  });
});
