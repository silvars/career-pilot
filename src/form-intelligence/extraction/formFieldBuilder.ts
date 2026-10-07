import type { FieldSource, FormElementType, FormField, FormOption } from "../types/formField.js";
import type { RawFormElement, RawFormMaterials, RawFormOption } from "./rawFormElement.js";
import { humanizeIdentifier, normalizeFieldText } from "../normalization/textNormalizer.js";

/** Control types that aren't real answerable fields for a candidate (SDD section 1/2 scope). */
const NON_FIELD_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

function resolveElementType(raw: RawFormElement): FormElementType | null {
  if (raw.tag === "TEXTAREA") {
    return "TEXTAREA";
  }
  if (raw.tag === "SELECT") {
    return "SELECT";
  }

  const inputType = (raw.inputType ?? "text").toLowerCase();
  if (inputType === "checkbox") {
    return "CHECKBOX";
  }
  if (inputType === "radio") {
    return "RADIO";
  }
  if (raw.role === "combobox" || raw.hasDatalist) {
    return "COMBOBOX";
  }
  if (NON_FIELD_INPUT_TYPES.has(inputType)) {
    return null;
  }
  return "TEXT";
}

/** Priority cascade for a single element's own label (SDD section 1). */
function resolveLabel(raw: RawFormElement): { label?: string; source: FieldSource } {
  const label = normalizeFieldText(raw.labelText);
  if (label) {
    return { label, source: "LABEL" };
  }

  const labelledBy = normalizeFieldText(raw.ariaLabelledByText);
  if (labelledBy) {
    return { label: labelledBy, source: "ARIA_LABELLEDBY" };
  }

  const ariaLabel = normalizeFieldText(raw.ariaLabel);
  if (ariaLabel) {
    return { label: ariaLabel, source: "ARIA_LABEL" };
  }

  const placeholder = normalizeFieldText(raw.placeholder);
  if (placeholder) {
    return { label: placeholder, source: "PLACEHOLDER" };
  }

  const name = normalizeFieldText(raw.name);
  if (name) {
    return { label: humanizeIdentifier(name), source: "NAME" };
  }

  const id = normalizeFieldText(raw.id);
  if (id) {
    return { label: humanizeIdentifier(id), source: "ID" };
  }

  return { label: undefined, source: "NONE" };
}

function normalizeOption(option: RawFormOption): FormOption {
  return { value: option.value, label: normalizeFieldText(option.label) ?? option.value ?? "" };
}

function buildSingleField(raw: RawFormElement, elementType: FormElementType, fallbackIndex: number): FormField {
  const { label, source } = resolveLabel(raw);

  const field: FormField = {
    id: raw.id ?? raw.name ?? `field-${fallbackIndex}`,
    elementType,
    label,
    name: raw.name,
    placeholder: normalizeFieldText(raw.placeholder),
    ariaLabel: normalizeFieldText(raw.ariaLabel),
    required: raw.required,
    source,
  };

  if (raw.value !== undefined) {
    field.value = raw.value;
  }
  const section = normalizeFieldText(raw.sectionHeading);
  if (section) {
    field.section = section;
  }
  if ((elementType === "SELECT" || elementType === "COMBOBOX") && raw.options) {
    field.options = raw.options.map(normalizeOption);
  }

  return field;
}

/** Groups same-`name` radio inputs into one FormField with multiple options (SDD section 8). */
function buildRadioGroupField(name: string, members: RawFormElement[]): FormField {
  const sharedGroupLabel = normalizeFieldText(members.find((m) => m.groupLabel)?.groupLabel);
  const firstMember = resolveLabel(members[0]);
  const label = sharedGroupLabel ?? firstMember.label;
  const source: FieldSource = sharedGroupLabel ? "LABEL" : firstMember.source;

  const options: FormOption[] = members.map((member) => {
    const { label: optionLabel } = resolveLabel(member);
    return { value: member.value, label: optionLabel ?? member.value ?? "" };
  });

  const section = normalizeFieldText(members.find((m) => m.sectionHeading)?.sectionHeading);

  const field: FormField = {
    id: name,
    elementType: "RADIO",
    label,
    name,
    required: members.some((m) => m.required),
    source,
    options,
  };
  if (section) {
    field.section = section;
  }
  return field;
}

/**
 * Pure transformation from raw DOM snapshot to structured `FormField[]`
 * (SDD "Form Intelligence" section 1/2/11) — no DOM access, fully
 * unit-testable. Radio inputs sharing a `name` are consolidated into a
 * single field with `options` (section 8); checkboxes are kept standalone
 * in this slice (grouping them into one multi-select question is a
 * classification concern, deferred). Non-field inputs (hidden/submit/
 * button/reset/image/file) are dropped.
 */
export function buildFormFields(materials: RawFormMaterials): FormField[] {
  const radioGroupMembers = new Map<string, RawFormElement[]>();
  for (const raw of materials.elements) {
    if (raw.tag === "INPUT" && (raw.inputType ?? "").toLowerCase() === "radio" && raw.name) {
      const members = radioGroupMembers.get(raw.name) ?? [];
      members.push(raw);
      radioGroupMembers.set(raw.name, members);
    }
  }

  const fields: FormField[] = [];
  const emittedRadioGroups = new Set<string>();
  let fallbackIndex = 0;

  for (const raw of materials.elements) {
    const elementType = resolveElementType(raw);
    if (!elementType) {
      continue;
    }

    if (elementType === "RADIO" && raw.name) {
      if (emittedRadioGroups.has(raw.name)) {
        continue;
      }
      emittedRadioGroups.add(raw.name);
      fields.push(buildRadioGroupField(raw.name, radioGroupMembers.get(raw.name)!));
      continue;
    }

    fields.push(buildSingleField(raw, elementType, fallbackIndex));
    fallbackIndex += 1;
  }

  return fields;
}

/**
 * For each element in `materials.elements` (same order), returns the
 * `FormField.id` it belongs to, or `null` if `buildFormFields` would drop
 * it (hidden/submit/button/reset/image/file). Lets a DOM-touching caller
 * (the Content Script, FASE 6.2) build its own `fieldId -> Element[]`
 * cache using the *exact* same id assignment `buildFormFields` uses —
 * without duplicating that logic and risking it drifting out of sync.
 */
export function mapElementsToFieldIds(materials: RawFormMaterials): Array<string | null> {
  const radioGroupMembers = new Map<string, RawFormElement[]>();
  for (const raw of materials.elements) {
    if (raw.tag === "INPUT" && (raw.inputType ?? "").toLowerCase() === "radio" && raw.name) {
      const members = radioGroupMembers.get(raw.name) ?? [];
      members.push(raw);
      radioGroupMembers.set(raw.name, members);
    }
  }

  const ids: Array<string | null> = [];
  let fallbackIndex = 0;

  for (const raw of materials.elements) {
    const elementType = resolveElementType(raw);
    if (!elementType) {
      ids.push(null);
      continue;
    }

    if (elementType === "RADIO" && raw.name) {
      ids.push(raw.name);
      continue;
    }

    ids.push(raw.id ?? raw.name ?? `field-${fallbackIndex}`);
    fallbackIndex += 1;
  }

  return ids;
}
