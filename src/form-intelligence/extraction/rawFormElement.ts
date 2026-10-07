/**
 * Plain, JSON-serializable snapshot of a form's DOM (SDD "Form Intelligence"
 * section 11: Content Script does raw DOM collection only; this project's
 * established convention — same as `src/extension/job-extraction/types.ts`'s
 * `RawElement`/`RawPageMaterials` — is that nothing here requires a live DOM,
 * so the interpretation layer (`formFieldBuilder.ts`) stays pure and testable.
 *
 * Label/aria-labelledby resolution (walking `<label for>`, wrapping labels,
 * or looking up the element(s) referenced by `aria-labelledby`) genuinely
 * requires DOM traversal — that happens once, in the content script, and the
 * *result* is passed here as plain text, never raw HTML.
 */
export type RawFormElementTag = "INPUT" | "TEXTAREA" | "SELECT";

export interface RawFormOption {
  value?: string;
  label: string;
}

export interface RawFormElement {
  tag: RawFormElementTag;
  /** For INPUT only — e.g. "text", "email", "checkbox", "radio", "tel", ... Defaults to "text" when absent. */
  inputType?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  /** Resolved by the content script via `<label for>` or a wrapping `<label>`. */
  labelText?: string;
  /** Resolved by the content script by looking up the element(s) referenced by `aria-labelledby`. */
  ariaLabelledByText?: string;
  required: boolean;
  value?: string;
  /** ARIA role, if any — used to detect the ARIA combobox pattern (text input + listbox, no native `<select>`). */
  role?: string;
  /** True when the input has a `list` attribute pointing at a `<datalist>` (the other common combobox pattern). */
  hasDatalist?: boolean;
  /** `<option>` elements — SELECT, or a COMBOBOX backed by a `<datalist>`. */
  options?: RawFormOption[];
  /** RADIO only: the shared question text for the group (e.g. a `<fieldset><legend>`), resolved by the content script. */
  groupLabel?: string;
  /** Best-effort nearest enclosing heading text — context for later classification, not used to resolve this field's own label. */
  sectionHeading?: string;
}

export interface RawFormMaterials {
  url: string;
  elements: RawFormElement[];
}
