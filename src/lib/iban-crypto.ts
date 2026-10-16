import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * IBAN-versleuteling (Community Hub, Fase 6). AES-256-GCM met een sleutel uit
 * `IBAN_ENCRYPTION_KEY` (32 bytes, base64 of hex). Opslagformaat:
 *   enc:v1:<iv b64url>:<ciphertext b64url>:<tag b64url>
 * Oude platte IBANs (zonder prefix) worden door `decryptIban` ongewijzigd
 * teruggegeven, zodat de migratie (`scripts/encrypt-ibans.ts`) rustig kan
 * draaien. In productie is de sleutel verplicht; lokaal valt hij terug op een
 * afgeleide van AUTH_SECRET met een waarschuwing.
 */

const PREFIX = "enc:v1:";
let cachedKey: Buffer | null = null;
let warned = false;

type Env = Readonly<Record<string, string | undefined>>;

function loadKey(env: Env = process.env): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.IBAN_ENCRYPTION_KEY?.trim();
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("IBAN_ENCRYPTION_KEY moet 32 bytes zijn (base64 of 64 hex-tekens).");
    cachedKey = buf;
    return buf;
  }
  if (env.NODE_ENV === "production") throw new Error("IBAN_ENCRYPTION_KEY ontbreekt: IBANs kunnen niet opgeslagen worden.");
  if (!warned) {
    console.warn("[iban-crypto] IBAN_ENCRYPTION_KEY ontbreekt; dev-sleutel afgeleid van AUTH_SECRET.");
    warned = true;
  }
  cachedKey = createHash("sha256").update(`iban:${env.AUTH_SECRET ?? "dev"}`).digest();
  return cachedKey;
}

/** Alleen voor tests: sleutelcache leegmaken. */
export function _resetIbanKeyCache(): void {
  cachedKey = null;
}

export function isEncryptedIban(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function encryptIban(plain: string, env?: Env): string {
  const normalized = plain.replace(/\s+/g, "").toUpperCase();
  if (isEncryptedIban(normalized)) return plain;
  const key = loadKey(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${ct.toString("base64url")}:${tag.toString("base64url")}`;
}

/** Geeft de platte IBAN terug; een niet-versleutelde waarde komt ongewijzigd terug. */
export function decryptIban(stored: string | null | undefined, env?: Env): string | null {
  if (!stored) return null;
  if (!isEncryptedIban(stored)) return stored;
  const [iv, ct, tag] = stored.slice(PREFIX.length).split(":");
  if (!iv || !ct || !tag) throw new Error("Ongeldig versleuteld IBAN-formaat");
  const decipher = createDecipheriv("aes-256-gcm", loadKey(env), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Gemaskeerd tonen zonder de hele IBAN te hoeven ontsleutelen in de UI: NL12 **** 1234. */
export function maskStoredIban(stored: string | null | undefined, env?: Env): string | null {
  const plain = decryptIban(stored, env);
  if (!plain) return null;
  const clean = plain.replace(/\s+/g, "");
  if (clean.length < 8) return "****";
  return `${clean.slice(0, 4)} **** ${clean.slice(-4)}`;
}
