/**
 * Duplicate detection. SPEC.md §7: "exact-match dedupe after
 * .normalize('NFC'). The same sentence twice, or once NFC and once NFD,
 * surfaces a toast rather than a silent duplicate point."
 */
export function normalizeForDedupe(text: string): string {
  return text.normalize("NFC").trim();
}

/** True if `candidate` NFC-normalizes to the same text as any of
 * `existingTexts` (also NFC-normalized before comparing). */
export function isDuplicateText(candidate: string, existingTexts: string[]): boolean {
  const normalized = normalizeForDedupe(candidate);
  if (normalized.length === 0) return false;
  return existingTexts.some((t) => normalizeForDedupe(t) === normalized);
}
