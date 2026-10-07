import type { AutofillAction, AutofillPlan } from "../../autofill/types/autofillAction.js";
import type { AutofillFieldResult, AutofillResult } from "../../autofill/types/autofillResult.js";
import { isNeverFillable } from "../../autofill/execute/neverFillable.js";
import type { FillableFieldDescriptor } from "../../autofill/execute/neverFillable.js";
import { valuesMatch } from "../../autofill/execute/valueComparison.js";
import { getCachedElements } from "./formExtractor.js";

function normalizeOptionText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function describeElement(element: Element): FillableFieldDescriptor {
  const asInput = element as HTMLInputElement;
  return {
    inputType: element instanceof HTMLInputElement ? asInput.type : undefined,
    autocomplete: element.getAttribute("autocomplete"),
    name: asInput.name || undefined,
    id: element.id || undefined,
  };
}

/** React controlled inputs ignore a plain `.value = x` assignment — the native setter bypasses React's own value tracker, so the subsequent bubbling `input`/`change` events are what React actually observes. */
function setNativeTextValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeChecked(element: HTMLInputElement, checked: boolean): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  if (setter) {
    setter.call(element, checked);
  } else {
    element.checked = checked;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeSelectValue(element: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function executeSetValue(action: AutofillAction, element: Element): AutofillFieldResult {
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    return { fieldId: action.fieldId, success: false, error: "element is not a text input or textarea" };
  }
  if (isNeverFillable(describeElement(element))) {
    return { fieldId: action.fieldId, success: false, error: "field is never auto-filled (password/payment)" };
  }

  const expected = action.value ?? "";
  setNativeTextValue(element, expected);
  const actual = element.value;
  const success = valuesMatch(expected, actual);

  return {
    fieldId: action.fieldId,
    success,
    expectedValue: expected,
    actualValue: actual,
    error: success ? undefined : "value mismatch after fill",
  };
}

function executeSelectOption(action: AutofillAction, elements: Element[]): AutofillFieldResult {
  const [first] = elements;

  if (first instanceof HTMLSelectElement) {
    const target = Array.from(first.options).find(
      (option) =>
        (action.value !== undefined && normalizeOptionText(option.value) === normalizeOptionText(action.value)) ||
        (action.optionLabel !== undefined &&
          normalizeOptionText(option.textContent ?? "") === normalizeOptionText(action.optionLabel))
    );
    if (!target) {
      return { fieldId: action.fieldId, success: false, error: "no matching <option> found in the DOM" };
    }
    setNativeSelectValue(first, target.value);
    const actual = first.options[first.selectedIndex]?.value;
    const success = actual !== undefined && normalizeOptionText(actual) === normalizeOptionText(target.value);
    return {
      fieldId: action.fieldId,
      success,
      expectedValue: target.value,
      actualValue: actual,
      error: success ? undefined : "selected value mismatch after fill",
    };
  }

  // RADIO group: `elements` are every member sharing the group's `name`.
  const target = elements.find((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio") {
      return false;
    }
    return action.value !== undefined && normalizeOptionText(element.value) === normalizeOptionText(action.value);
  }) as HTMLInputElement | undefined;

  if (!target) {
    return { fieldId: action.fieldId, success: false, error: "no matching radio option found in the DOM" };
  }
  if (isNeverFillable(describeElement(target))) {
    return { fieldId: action.fieldId, success: false, error: "field is never auto-filled (password/payment)" };
  }

  setNativeChecked(target, true);
  const success = target.checked;
  return {
    fieldId: action.fieldId,
    success,
    expectedValue: action.value,
    actualValue: success ? target.value : undefined,
    error: success ? undefined : "radio was not checked after fill",
  };
}

function executeCheckbox(action: AutofillAction, element: Element, checked: boolean): AutofillFieldResult {
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") {
    return { fieldId: action.fieldId, success: false, error: "element is not a checkbox" };
  }
  if (isNeverFillable(describeElement(element))) {
    return { fieldId: action.fieldId, success: false, error: "field is never auto-filled (password/payment)" };
  }

  setNativeChecked(element, checked);
  const success = element.checked === checked;
  return {
    fieldId: action.fieldId,
    success,
    expectedValue: String(checked),
    actualValue: String(element.checked),
    error: success ? undefined : "checkbox state mismatch after fill",
  };
}

function executeAction(action: AutofillAction): AutofillFieldResult {
  try {
    const elements = getCachedElements(action.fieldId);
    if (!elements || elements.length === 0) {
      return {
        fieldId: action.fieldId,
        success: false,
        error: "element not found in the DOM (page may have changed since analysis)",
      };
    }

    switch (action.action) {
      case "SET_VALUE":
        return executeSetValue(action, elements[0]);
      case "SELECT_OPTION":
        return executeSelectOption(action, elements);
      case "CHECK":
        return executeCheckbox(action, elements[0], true);
      case "UNCHECK":
        return executeCheckbox(action, elements[0], false);
      case "SKIP":
        // Unreachable: executeAutofillPlan filters SKIP actions out before calling this.
        return { fieldId: action.fieldId, success: true };
    }
  } catch (cause) {
    return { fieldId: action.fieldId, success: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/**
 * Executes an already-built, already-reviewed AutofillPlan (SDD "Autofill"
 * section 5/6) — the only Content Script code allowed to write to the
 * page's form (section 1.4). Never re-discovers or reclassifies fields,
 * never generates new answers, never clicks anything beyond a radio/
 * checkbox toggle, never touches Submit/Apply/Send/Continue/Next, never
 * calls `form.submit()`/`requestSubmit()`. Zero retries — each action runs
 * at most once; an individual failure never stops the rest (SDD rule 14).
 */
export async function executeAutofillPlan(plan: AutofillPlan): Promise<AutofillResult> {
  const fields: AutofillFieldResult[] = [];

  for (const action of plan.actions) {
    if (action.action === "SKIP") {
      continue;
    }
    fields.push(executeAction(action));
  }

  const summary = {
    attempted: fields.length,
    filled: fields.filter((field) => field.success).length,
    failed: fields.filter((field) => !field.success).length,
    skipped: plan.actions.length - fields.length,
  };

  return { success: summary.failed === 0, fields, summary };
}
