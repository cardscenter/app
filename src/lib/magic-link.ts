/**
 * Inloglink per e-mail (Community Hub, Fase 2). Pure helpers; de DB-laag en
 * de Auth.js-provider zitten in `src/lib/auth.ts` en `src/actions/auth.ts`.
 *
 * Model: het ruwe token gaat alleen in de mail; in de DB staat de SHA-256-
 * hash. Eén token is 15 minuten geldig en eenmalig bruikbaar. Aanvragen is
 * gelimiteerd tot één per minuut per adres (anti-spam) en de actie antwoordt
 * altijd "als dit adres bekend is, is er een link onderweg" (geen enumeratie).
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_MIN_INTERVAL_MS = 60 * 1000;

export function generateMagicToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMagicToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function magicTokenHashesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vorm-check vóór de DB-lookup: base64url van 32 bytes = 43 tekens. */
export function looksLikeMagicToken(token: string | null | undefined): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
