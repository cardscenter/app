/**
 * In-memory rate-limiter voor login-pogingen (Fase 37).
 * Simpel patroon: bij N foute pogingen op zelfde IP binnen WINDOW_MS → cooldown.
 *
 * Caveats:
 * - In-memory Map verdwijnt bij server-restart en is per-instance bij multi-host
 *   hosting (Vercel-serverless verdeelt requests over isolates). Acceptabel voor
 *   Railway single-instance setup van Cards Center (zie CLAUDE.md Fase 30 — same
 *   trade-off als SSE-channels). Bij multi-instance hosting swappen naar Redis.
 * - IP-spoofing via X-Forwarded-For: NextAuth-IP-capture in auth.ts heeft hier
 *   al een fallback-chain — we hergebruiken dezelfde extractie.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minuten
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minuten

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  cooldownUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

/** Check of een IP momenteel in cooldown zit. Returnt remaining ms of 0. */
export function getCooldownRemaining(ip: string): number {
  const record = attempts.get(ip);
  if (!record?.cooldownUntil) return 0;
  const remaining = record.cooldownUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(ip);
    return 0;
  }
  return remaining;
}

/** Registreer een mislukte login-poging. Returnt of de cooldown nu actief is. */
export function recordFailedAttempt(ip: string): { cooldownActive: boolean; cooldownMs: number } {
  const now = Date.now();
  const record = attempts.get(ip);

  // Buiten het window → reset counter
  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttemptAt: now });
    return { cooldownActive: false, cooldownMs: 0 };
  }

  const newCount = record.count + 1;
  if (newCount >= MAX_ATTEMPTS) {
    const cooldownUntil = now + COOLDOWN_MS;
    attempts.set(ip, { ...record, count: newCount, cooldownUntil });
    return { cooldownActive: true, cooldownMs: COOLDOWN_MS };
  }

  attempts.set(ip, { ...record, count: newCount });
  return { cooldownActive: false, cooldownMs: 0 };
}

/** Reset alle pogingen voor een IP — bv. na succesvolle login. */
export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

/** Helper om IP uit headers te extraheren (gelijk aan auth.ts captureLoginIp). */
export function extractIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
