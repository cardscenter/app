/**
 * "Vertrouw dit apparaat 30 dagen" (Fase 16-followup, 2FA).
 *
 * Stateless: een httpOnly-cookie met HMAC-SHA256 over userId + expiry + het
 * actuele totpSecret. Doordat het secret in het MAC-materiaal zit, worden
 * álle vertrouwde apparaten automatisch ongeldig zodra 2FA opnieuw wordt
 * ingesteld of uitgezet (totpSecret wijzigt/verdwijnt) — geen aparte
 * revoke-tabel nodig.
 *
 * Cookie-formaat: `${expiresAtMs}.${base64url(hmac)}` per user gevalideerd.
 * Gebruikt door de login-flow (authorize) én de step-up-checks.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const TRUSTED_DEVICE_DAYS = 30;
const COOKIE_NAME = "cc_trusted_device";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ontbreekt — nodig voor trusted-device-cookies.");
  return secret;
}

function sign(userId: string, expiresAtMs: number, totpSecret: string): Buffer {
  return createHmac("sha256", getSecret())
    .update(`trust:${userId}:${expiresAtMs}:${totpSecret}`)
    .digest();
}

/** Zet de trusted-device-cookie (na een geslaagde 2FA-login met de toggle aan). */
export async function setTrustedDeviceCookie(userId: string, totpSecret: string): Promise<void> {
  const expiresAtMs = Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000;
  const sig = sign(userId, expiresAtMs, totpSecret).toString("base64url");
  const store = await cookies();
  store.set(COOKIE_NAME, `${expiresAtMs}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60,
  });
}

/** True als dit apparaat een geldige, niet-verlopen trust-cookie voor deze user heeft. */
export async function isTrustedDevice(userId: string, totpSecret: string): Promise<boolean> {
  try {
    const store = await cookies();
    const value = store.get(COOKIE_NAME)?.value;
    if (!value) return false;

    const dot = value.indexOf(".");
    if (dot === -1) return false;
    const expiresAtMs = Number(value.slice(0, dot));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

    const expected = sign(userId, expiresAtMs, totpSecret);
    const provided = Buffer.from(value.slice(dot + 1), "base64url");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    // cookies() niet beschikbaar in deze context → behandel als niet-vertrouwd.
    return false;
  }
}
