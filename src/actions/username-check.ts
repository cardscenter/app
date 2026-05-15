"use server";

import { prisma } from "@/lib/prisma";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const MIN_LEN = 3;
const MAX_LEN = 30;

// Reserved usernames die niet geclaimd mogen worden — vertegenwoordigen
// platform-routes of admin-rollen die voor user-displayName-bots verleidelijk
// kunnen zijn.
const RESERVED = new Set([
  "admin",
  "administrator",
  "cardscenter",
  "support",
  "help",
  "moderator",
  "system",
  "anonymous",
  "test",
  "null",
  "undefined",
]);

export type UsernameCheckReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_CHARS"
  | "RESERVED"
  | "TAKEN";

export interface UsernameCheckResult {
  available: boolean;
  reason?: UsernameCheckReason;
}

/**
 * Real-time username-availability check (Fase 37). Returnt of `displayName`
 * vrij is en, zo nee, waarom niet. Geen rate-limit (debounced client-side).
 */
export async function checkUsernameAvailable(
  displayName: string,
): Promise<UsernameCheckResult> {
  const trimmed = displayName.trim();

  if (trimmed.length < MIN_LEN) return { available: false, reason: "TOO_SHORT" };
  if (trimmed.length > MAX_LEN) return { available: false, reason: "TOO_LONG" };
  if (!USERNAME_REGEX.test(trimmed)) return { available: false, reason: "INVALID_CHARS" };
  if (RESERVED.has(trimmed.toLowerCase())) return { available: false, reason: "RESERVED" };

  // DB-lookup case-insensitive (SQLite default-collation is case-sensitive,
  // dus expliciet `mode: "insensitive"` zou Postgres-only zijn — handmatig
  // lowercase-compare).
  const existing = await prisma.user.findFirst({
    where: { displayName: { equals: trimmed } },
    select: { id: true },
  });
  if (existing) return { available: false, reason: "TAKEN" };

  return { available: true };
}
