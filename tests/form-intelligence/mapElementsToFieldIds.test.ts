import { describe, expect, it } from "vitest";
import { mapElementsToFieldIds } from "../../src/form-intelligence/extraction/formFieldBuilder.js";
import type { RawFormMaterials } from "../../src/form-intelligence/extraction/rawFormElement.js";

describe("mapElementsToFieldIds", () => {
  it("assigns the same id/name-based fieldId buildFormFields would use for simple fields", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "text", id: "fullName", name: "fullName", required: true, labelText: "Full name" },
        { tag: "INPUT", inputType: "email", name: "email", required: false, labelText: "Email" },
        { tag: "INPUT", inputType: "text", placeholder: "Expected salary", required: false },
      ],
    };

    expect(mapElementsToFieldIds(materials)).toEqual(["fullName", "email", "field-2"]);
  });

  it("maps every radio input in a group to the SAME fieldId (the group's name), one entry per DOM element", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        {
          tag: "INPUT",
          inputType: "radio",
          id: "wm1",
          name: "workModel",
          value: "remote",
          required: false,
          labelText: "Remote",
          groupLabel: "Work model",
        },
        {
          tag: "INPUT",
          inputType: "radio",
          id: "wm2",
          name: "workModel",
          value: "hybrid",
          required: false,
          labelText: "Hybrid",
          groupLabel: "Work model",
        },
        {
          tag: "INPUT",
          inputType: "radio",
          id: "wm3",
          name: "workModel",
          value: "onsite",
          required: false,
          labelText: "On-site",
          groupLabel: "Work model",
        },
      ],
    };

    expect(mapElementsToFieldIds(materials)).toEqual(["workModel", "workModel", "workModel"]);
  });

  it("returns null for dropped non-field inputs (hidden/submit/button/reset/image/file), without consuming a fallback index", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "hidden", name: "csrf", required: false },
        { tag: "INPUT", inputType: "text", placeholder: "First", required: false },
        { tag: "INPUT", inputType: "submit", required: false },
        { tag: "INPUT", inputType: "text", placeholder: "Second", required: false },
      ],
    };

    expect(mapElementsToFieldIds(materials)).toEqual([null, "field-0", null, "field-1"]);
  });

  it("stays index-aligned with materials.elements even when the form mixes radio groups, dropped elements and fallback ids", () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "hidden", name: "token", required: false },
        { tag: "INPUT", inputType: "radio", name: "wm", value: "remote", required: false },
        { tag: "INPUT", inputType: "radio", name: "wm", value: "onsite", required: false },
        { tag: "INPUT", inputType: "text", placeholder: "Notes", required: false },
      ],
    };

    const ids = mapElementsToFieldIds(materials);

    expect(ids).toHaveLength(4);
    expect(ids).toEqual([null, "wm", "wm", "field-0"]);
  });
});
