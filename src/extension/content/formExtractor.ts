import type { RawFormElement, RawFormMaterials, RawFormOption } from "../../form-intelligence/extraction/rawFormElement.js";

/**
 * DOM-touching layer only (SDD "Form Intelligence" section 11: "Content
 * Script: DOM -> FormField extraction") — deliberately thin and not
 * directly unit-tested, same convention as `collectRawMaterials()` in
 * `content-script.ts`. All interpretation (label priority, grouping,
 * normalization) lives in `src/form-intelligence/extraction/
 * formFieldBuilder.ts`, which is pure and fully unit-tested against
 * hand-built `RawFormMaterials` fixtures instead.
 *
 * Queries the whole document for input/textarea/select, not just elements
 * inside a `<form>` tag — many real ATS pages (Greenhouse/Lever/InHire-
 * style single-page apps) render form fields without a wrapping `<form>`.
 */
const FIELD_SELECTOR = "input, textarea, select";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, legend";

function resolveLabelText(element: Element): string | undefined {
  const id = element.getAttribute("id");
  if (id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (forLabel?.textContent) {
      return forLabel.textContent;
    }
  }
  const wrappingLabel = element.closest("label");
  return wrappingLabel?.textContent ?? undefined;
}

function resolveAriaLabelledByText(element: Element): string | undefined {
  const ids = element.getAttribute("aria-labelledby");
  if (!ids) {
    return undefined;
  }
  const text = ids
    .split(/\s+/)
    .filter(Boolean)
    .map((refId) => document.getElementById(refId)?.textContent ?? "")
    .join(" ")
    .trim();
  return text.length > 0 ? text : undefined;
}

/** Best-effort: the nearest `<fieldset><legend>` (or `role="radiogroup"`'s own label) enclosing this element. */
function resolveGroupLabel(element: Element): string | undefined {
  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend?.textContent) {
    return legend.textContent;
  }
  const radiogroup = element.closest('[role="radiogroup"]');
  return radiogroup?.getAttribute("aria-label") ?? undefined;
}

/** Best-effort: nearest preceding heading in document order, scanning up a limited number of ancestor levels. */
function resolveSectionHeading(element: Element): string | undefined {
  let node: Element | null = element;
  for (let depth = 0; node && depth < 6; depth++) {
    let sibling: Element | null = node.previousElementSibling;
    while (sibling) {
      if (sibling.matches(HEADING_SELECTOR) && sibling.textContent) {
        return sibling.textContent;
      }
      const heading = sibling.querySelector(HEADING_SELECTOR);
      if (heading?.textContent) {
        return heading.textContent;
      }
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }
  return undefined;
}

function resolveDatalistOptions(element: Element): RawFormOption[] | undefined {
  const listId = element.getAttribute("list");
  if (!listId) {
    return undefined;
  }
  const datalist = document.getElementById(listId);
  if (!datalist) {
    return undefined;
  }
  const options = Array.from(datalist.querySelectorAll("option")).map((option) => ({
    value: option.getAttribute("value") ?? undefined,
    label: option.textContent ?? option.getAttribute("value") ?? "",
  }));
  return options.length > 0 ? options : undefined;
}

function toRawFormElement(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): RawFormElement {
  const tag = element.tagName as RawFormElement["tag"];
  const inputType = tag === "INPUT" ? (element as HTMLInputElement).type : undefined;

  const base: RawFormElement = {
    tag,
    inputType,
    id: element.id || undefined,
    name: element.name || undefined,
    required: element.required,
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    labelText: resolveLabelText(element),
    ariaLabelledByText: resolveAriaLabelledByText(element),
    sectionHeading: resolveSectionHeading(element),
  };

  if (tag === "INPUT" || tag === "TEXTAREA") {
    base.placeholder = element.getAttribute("placeholder") ?? undefined;
  }
  if (tag === "INPUT") {
    const input = element as HTMLInputElement;
    base.value = input.value || undefined;
    base.role = input.getAttribute("role") ?? undefined;
    base.hasDatalist = Boolean(input.getAttribute("list"));
    base.options = resolveDatalistOptions(input);
    if (inputType === "radio") {
      base.groupLabel = resolveGroupLabel(input);
    }
  }
  if (tag === "SELECT") {
    const select = element as HTMLSelectElement;
    base.options = Array.from(select.options).map((option) => ({
      value: option.value || undefined,
      label: option.textContent ?? option.value ?? "",
    }));
  }

  return base;
}

export function collectRawFormMaterials(): RawFormMaterials {
  const elements = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    FIELD_SELECTOR
  )).map(toRawFormElement);

  return { url: window.location.href, elements };
}
