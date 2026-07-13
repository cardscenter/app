import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Case-insensitive lookup van een bestaande user op displayName (Fase 43).
 *
 * SQLite/libSQL is standaard case-sensitive op TEXT en Prisma's
 * `mode: "insensitive"` is Postgres-only — daarom een raw query met
 * COLLATE NOCASE. NOCASE is ASCII-only, wat volstaat: USERNAME_REGEX staat
 * alleen ASCII toe. Werkt identiek op lokale SQLite en Turso (libSQL).
 *
 * Let op: dit is een pre-check; de @unique-index op displayName blijft
 * case-sensitive, dus twee exact gelijktijdige registraties met case-varianten
 * blijven een theoretisch TOCTOU-restrisico (follow-up: genormaliseerde
 * unique-kolom).
 */
export async function findUserByNameInsensitive(
  displayName: string,
): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE "displayName" = ${displayName} COLLATE NOCASE LIMIT 1
  `;
  return rows[0] ?? null;
}
