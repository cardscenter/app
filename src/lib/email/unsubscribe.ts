/**
 * Unsubscribe-tokens voor e-mail-footers (Fase 16).
 *
 * HMAC-SHA256 met AUTH_SECRET over `userId:category` — stateless, geen
 * DB-tabel nodig, en de link blijft permanent geldig (bewust: een oude mail
 * moet altijd een werkende afmeldlink hebben).
 * Formaat: base64url(userId).base64url(category).base64url(hmac)
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { EmailPrefCategory } from "@/lib/email/preferences-config";
import { EMAIL_PREF_CATEGORIES } from "@/lib/email/preferences-config";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET ontbreekt — nodig voor unsubscribe-tokens.");
  return secret;
}

function sign(userId: string, category: string): Buffer {
  return createHmac("sha256", getSecret()).update(`unsub:${userId}:${category}`).digest();
}

export function createUnsubscribeToken(userId: string, category: EmailPrefCategory): string {
  const sig = sign(userId, category).toString("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${Buffer.from(category).toString("base64url")}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { userId: string; category: EmailPrefCategory } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const userId = Buffer.from(parts[0], "base64url").toString();
    const category = Buffer.from(parts[1], "base64url").toString();
    if (!EMAIL_PREF_CATEGORIES.some((c) => c.key === category)) return null;

    const expected = sign(userId, category);
    const provided = Buffer.from(parts[2], "base64url");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return null;
    }
    return { userId, category: category as EmailPrefCategory };
  } catch {
    return null;
  }
}
