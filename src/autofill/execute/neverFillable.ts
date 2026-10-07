/** Plain descriptor (not a live DOM Element) so this stays unit-testable without jsdom — mirrors the handful of attributes the executor can read from a real element. */
export interface FillableFieldDescriptor {
  inputType?: string;
  autocomplete?: string | null;
  name?: string;
  id?: string;
}

const PAYMENT_AUTOCOMPLETE_PREFIX = "cc-";
const PAYMENT_KEYWORDS = [
  "card number",
  "cardnumber",
  "creditcard",
  "credit card",
  "cvv",
  "cvc",
  "routing number",
  "account number",
  "iban",
];

/**
 * Hard "never auto-fill" gate, independent of whatever the AutofillPlan
 * decided (SDD "Autofill" rule 10) — `type="password"` is a reliable DOM
 * signal; payment fields have no equivalent, so this uses the standard
 * HTML `autocomplete="cc-*"` tokens first (most reliable), falling back to
 * a curated keyword list over name/id (same "no NLP, no LLM, curated and
 * not exhaustive" philosophy used throughout this project).
 */
export function isNeverFillable(descriptor: FillableFieldDescriptor): boolean {
  if (descriptor.inputType === "password") {
    return true;
  }
  if (descriptor.autocomplete?.toLowerCase().startsWith(PAYMENT_AUTOCOMPLETE_PREFIX)) {
    return true;
  }
  const haystack = `${descriptor.name ?? ""} ${descriptor.id ?? ""}`
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]/g, " ");
  return PAYMENT_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
