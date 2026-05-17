/**
 * Status-aware edit-scope voor veilingen (Fase Mijn-Veilingen redesign).
 *
 * Welke velden mag een seller wijzigen op een bestaande veiling? Hangt af van
 * status + of er al biedingen zijn:
 *
 *   FULL              — SCHEDULED + 0 biedingen: alles editable
 *   TIMING_LOCKED     — ACTIVE + 0 biedingen: alles behalve startDate/duration/endTimeOfDay
 *   DESCRIPTION_ONLY  — ACTIVE + ≥1 bod: alleen description + additive image-add + labels-add
 *   NONE              — alle ended statussen + AWAITING_*: niets bewerkbaar
 *
 * Gedeeld tussen server-action (validatie) en edit-drawer client (lock-UI),
 * zodat scope-logica één bron van waarheid heeft.
 */

export type EditScope = "FULL" | "TIMING_LOCKED" | "DESCRIPTION_ONLY" | "NONE";

export function computeEditScope(status: string, bidCount: number): EditScope {
  if (status === "SCHEDULED" && bidCount === 0) return "FULL";
  if (status === "ACTIVE" && bidCount === 0) return "TIMING_LOCKED";
  if (status === "ACTIVE" && bidCount > 0) return "DESCRIPTION_ONLY";
  return "NONE";
}
