/** Collapses whitespace/newlines and trims — returns undefined for empty/whitespace-only input. */
export function normalizeFieldText(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Turns a machine identifier (`name`/`id`, e.g. "expectedSalary",
 * "current_job_title") into a readable fallback label ("Expected Salary",
 * "Current Job Title") — used only when no real label/aria/placeholder
 * signal exists (SDD "Form Intelligence" section 1: name/id are explicitly
 * the lowest-priority signal, "não depender somente de name ou id").
 */
export function humanizeIdentifier(identifier: string): string {
  const words = identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
