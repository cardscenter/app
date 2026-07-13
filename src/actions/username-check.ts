"use server";

import {
  validateUsername,
  type UsernamePolicyReason,
} from "@/lib/username-policy";
import { findUserByNameInsensitive } from "@/lib/username-policy-server";

export type UsernameCheckReason = UsernamePolicyReason | "TAKEN";

export interface UsernameCheckResult {
  available: boolean;
  reason?: UsernameCheckReason;
}

/**
 * Real-time username-availability check (Fase 37, policy gecentraliseerd in
 * Fase 43 — zie src/lib/username-policy.ts). Returnt of `displayName` vrij is
 * en, zo nee, waarom niet. Geen rate-limit (debounced client-side).
 */
export async function checkUsernameAvailable(
  displayName: string,
): Promise<UsernameCheckResult> {
  const trimmed = displayName.trim();

  const policy = validateUsername(trimmed);
  if (!policy.ok) return { available: false, reason: policy.reason };

  // Case-insensitive DB-lookup via COLLATE NOCASE (Fase 43 — de oude
  // findFirst-equals was op SQLite stiekem case-sensitive).
  const existing = await findUserByNameInsensitive(trimmed);
  if (existing) return { available: false, reason: "TAKEN" };

  return { available: true };
}
