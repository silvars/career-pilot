import { describe, expect, it } from "vitest";
import { matchOption } from "../../src/autofill/plan/optionMatcher.js";
import type { FormField } from "../../src/form-intelligence/types/formField.js";

function selectField(options: Array<{ value?: string; label: string }>): FormField {
  return { id: "f1", elementType: "SELECT", required: false, source: "LABEL", options };
}

describe("matchOption", () => {
  it("matches by exact value", () => {
    const field = selectField([{ value: "jr", label: "Junior" }, { value: "sr", label: "Senior" }]);
    expect(matchOption(field, "sr")).toEqual({ value: "sr", label: "Senior" });
  });

  it("matches by exact label when value doesn't match", () => {
    const field = selectField([{ value: "jr", label: "Junior" }, { value: "sr", label: "Senior" }]);
    expect(matchOption(field, "Senior")).toEqual({ value: "sr", label: "Senior" });
  });

  it("matching is diacritics/case/whitespace insensitive", () => {
    const field = selectField([{ value: "sp", label: "São Paulo" }]);
    expect(matchOption(field, "  sao paulo  ")).toEqual({ value: "sp", label: "São Paulo" });
  });

  it("returns undefined for a value that doesn't exist among the options (never guesses)", () => {
    const field = selectField([{ value: "jr", label: "Junior" }, { value: "sr", label: "Senior" }]);
    expect(matchOption(field, "Staff")).toBeUndefined();
  });

  it("returns undefined when the field has no options at all", () => {
    const field: FormField = { id: "f1", elementType: "TEXT", required: false, source: "LABEL" };
    expect(matchOption(field, "anything")).toBeUndefined();
  });

  it("does not do partial/fuzzy matching (near-miss must not match)", () => {
    const field = selectField([{ value: "remote", label: "Remote" }, { value: "remote-first", label: "Remote-first" }]);
    expect(matchOption(field, "Remote work")).toBeUndefined();
  });
});
