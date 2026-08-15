/**
 * Session caps. SPEC.md §7: "200 notes or 200,000 characters per session,
 * then a clear refusal — not silent truncation of input (per-sentence
 * truncation per §3 is a separate, disclosed behaviour)."
 */
export const MAX_NOTES = 200;
export const MAX_TOTAL_CHARACTERS = 200_000;

export interface SessionTotals {
  noteCount: number;
  totalCharacters: number;
}

export type CapCheckResult = { allowed: true } | { allowed: false; reason: "notes" | "characters" };

/** Would adding `newText` push the session over either cap? A pure
 * decision, not an enforcement mechanism — the caller (session state)
 * refuses the add and shows the reason; nothing here truncates anything. */
export function checkCaps(current: SessionTotals, newText: string): CapCheckResult {
  if (current.noteCount + 1 > MAX_NOTES) {
    return { allowed: false, reason: "notes" };
  }
  if (current.totalCharacters + newText.length > MAX_TOTAL_CHARACTERS) {
    return { allowed: false, reason: "characters" };
  }
  return { allowed: true };
}
