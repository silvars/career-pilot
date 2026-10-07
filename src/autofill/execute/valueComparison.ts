/** Text comparison after fill (SDD "Autofill" decision #6): trim + case-insensitive, never exact-byte comparison. */
export function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase();
}

export function valuesMatch(expected: string, actual: string): boolean {
  return normalizeForComparison(expected) === normalizeForComparison(actual);
}
