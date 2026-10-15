/**
 * Rollen (Community Hub, Fase 2). Puur bestand (ook client-safe).
 *
 * `User.role` = PLAYER | STAFF | ADMIN, los van het tier (`accountType`).
 * Admin-bepaling blijft `accountType === "ADMIN"` (requireAdmin, 2FA-plicht);
 * `effectiveRole` maakt dat consistent: een ADMIN-accountType is altijd ADMIN,
 * wat er ook in `role` staat.
 */

export const ROLES = ["PLAYER", "STAFF", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  PLAYER: "Speler",
  STAFF: "Staff",
  ADMIN: "Admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function effectiveRole(user: { role?: string | null; accountType?: string | null }): Role {
  if (user.accountType === "ADMIN") return "ADMIN";
  return isRole(user.role) ? user.role : "PLAYER";
}

/** Staff of admin: mag inchecken, bestellingen en bulk-aanvragen verwerken. */
export function isStaff(user: { role?: string | null; accountType?: string | null }): boolean {
  const r = effectiveRole(user);
  return r === "STAFF" || r === "ADMIN";
}
