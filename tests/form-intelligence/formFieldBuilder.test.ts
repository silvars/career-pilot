import { describe, expect, it } from "vitest";
import { buildFormFields } from "../../src/form-intelligence/extraction/formFieldBuilder.js";
import type { RawFormMaterials } from "../../src/form-intelligence/extraction/rawFormElement.js";

describe("buildFormFields", () => {
  it("fixture 1 — simple labeled form: resolves label via <label for>", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "text", id: "fullName", name: "fullName", required: true, labelText: "Full name" },
        { tag: "INPUT", inputType: "email", id: "email", name: "email", required: false, labelText: "Email" },
      ],
    };

    const fields = buildFormFields(materials);

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      id: "fullName",
      elementType: "TEXT",
      label: "Full name",
      source: "LABEL",
      required: true,
    });
    expect(fields[1]).toMatchObject({ id: "email", label: "Email", source: "LABEL", required: false });
  });

  it("fixture 2 — placeholder-only field (no label/aria/id/name): falls back to placeholder", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [{ tag: "INPUT", inputType: "text", placeholder: "Expected salary", required: false }],
    };

    const [field] = buildFormFields(materials);

    expect(field).toMatchObject({ id: "field-0", label: "Expected salary", source: "PLACEHOLDER" });
  });

  it("fixture 3 — select + radio group + standalone checkbox", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        {
          tag: "SELECT",
          name: "seniority",
          required: false,
          options: [
            { value: "junior", label: "Junior" },
            { value: "senior", label: "Senior" },
          ],
        },
        { tag: "INPUT", inputType: "radio", id: "wm1", name: "workModel", value: "remote", required: false, labelText: "Remote", groupLabel: "Work model" },
        { tag: "INPUT", inputType: "radio", id: "wm2", name: "workModel", value: "hybrid", required: false, labelText: "Hybrid", groupLabel: "Work model" },
        { tag: "INPUT", inputType: "radio", id: "wm3", name: "workModel", value: "onsite", required: false, labelText: "On-site", groupLabel: "Work model" },
        { tag: "INPUT", inputType: "checkbox", id: "terms", name: "terms", required: true, labelText: "I agree to the terms" },
      ],
    };

    const fields = buildFormFields(materials);

    expect(fields).toHaveLength(3);

    const select = fields.find((f) => f.id === "seniority")!;
    expect(select).toMatchObject({ elementType: "SELECT" });
    expect(select.options).toEqual([
      { value: "junior", label: "Junior" },
      { value: "senior", label: "Senior" },
    ]);

    const radioGroup = fields.find((f) => f.id === "workModel")!;
    expect(radioGroup).toMatchObject({ elementType: "RADIO", label: "Work model", source: "LABEL", required: false });
    expect(radioGroup.options).toEqual([
      { value: "remote", label: "Remote" },
      { value: "hybrid", label: "Hybrid" },
      { value: "onsite", label: "On-site" },
    ]);

    const terms = fields.find((f) => f.id === "terms")!;
    expect(terms).toMatchObject({ elementType: "CHECKBOX", label: "I agree to the terms", required: true });
    expect(terms.options).toBeUndefined();
  });

  it("fixture 4 — no evidence at all vs. name-only (humanized fallback)", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "text", required: false },
        { tag: "INPUT", inputType: "text", name: "currentJobTitle", required: false },
      ],
    };

    const fields = buildFormFields(materials);

    expect(fields[0]).toMatchObject({ id: "field-0", label: undefined, source: "NONE" });
    expect(fields[1]).toMatchObject({ id: "currentJobTitle", label: "Current Job Title", source: "NAME" });
  });

  it("fixture 5 — ATS-like form: aria-labelledby, datalist combobox, hidden/submit excluded", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "TEXTAREA", required: true, ariaLabelledByText: "Why are you interested in this position?" },
        {
          tag: "INPUT",
          inputType: "text",
          ariaLabel: "Current location",
          hasDatalist: true,
          required: false,
          options: [
            { value: "São Paulo", label: "São Paulo" },
            { value: "Remote", label: "Remote" },
          ],
        },
        { tag: "INPUT", inputType: "hidden", name: "csrf_token", value: "abc123", required: false },
        { tag: "INPUT", inputType: "submit", value: "Apply", required: false },
      ],
    };

    const fields = buildFormFields(materials);

    expect(fields).toHaveLength(2);

    expect(fields[0]).toMatchObject({
      elementType: "TEXTAREA",
      label: "Why are you interested in this position?",
      source: "ARIA_LABELLEDBY",
      required: true,
    });

    expect(fields[1]).toMatchObject({ elementType: "COMBOBOX", label: "Current location", source: "ARIA_LABEL" });
    expect(fields[1].options).toEqual([
      { value: "São Paulo", label: "São Paulo" },
      { value: "Remote", label: "Remote" },
    ]);
  });
});
