/**
 * Gedeelde 2FA-verificatie (Fase 16-followup) — gebruikt door zowel de
 * login-flow (src/lib/auth.ts authorize) als de disable-action.
 *
 * Een code is geldig als het (a) een kloppende 6-cijferige TOTP-code is
 * (window 1 voor klok-drift), of (b) een ongebruikte backup-code
 * (XXXX-XXXX, bcrypt-gehasht in User.totpBackupCodes). Backup-codes zijn
 * eenmalig: geef `consumeForUserId` mee om de gematchte hash direct uit de
 * array te verwijderen.
 */

import bcrypt from "bcryptjs";
import { verify as verifyTotp } from "otplib";
import { prisma } from "@/lib/prisma";

export const BACKUP_CODE_COUNT = 8;

// ±30s tolerantie = accepteer de vorige/volgende 30s-stap ook (klok-drift telefoon).
export const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

/**
 * Step-up-check voor gevoelige acties (uitbetaling, IBAN wijzigen, wachtwoord
 * wijzigen). Verloop:
 *   - 2FA uit → "ok" (niets te checken)
 *   - vertrouwd apparaat (30d-cookie) → "ok"
 *   - geen code meegegeven → "code_required" (UI toont het code-veld)
 *   - code klopt (TOTP of backup, backup wordt verbruikt) → "ok", anders "invalid"
 */
export async function requireTotpStepUp(
  userId: string,
  code: string | null | undefined,
): Promise<"ok" | "code_required" | "invalid"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecret: true, totpBackupCodes: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) return "ok";

  const { isTrustedDevice } = await import("@/lib/trusted-device");
  if (await isTrustedDevice(userId, user.totpSecret)) return "ok";

  const trimmed = code?.trim();
  if (!trimmed) return "code_required";

  const check = await verifyTotpOrBackupCode({
    code: trimmed,
    totpSecret: user.totpSecret,
    backupCodesJson: user.totpBackupCodes,
    consumeForUserId: userId,
  });
  return check.valid ? "ok" : "invalid";
}

export async function verifyTotpOrBackupCode(args: {
  code: string;
  totpSecret: string;
  backupCodesJson: string | null;
  /** Indien gezet: verwijder de gematchte backup-code direct (eenmalig gebruik). */
  consumeForUserId?: string;
}): Promise<{ valid: boolean; usedBackupCode: boolean }> {
  const code = args.code.replace(/\s/g, "").toUpperCase();

  // 6 cijfers → TOTP-pad.
  if (/^\d{6}$/.test(code)) {
    const result = await verifyTotp({
      secret: args.totpSecret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    return { valid: result.valid, usedBackupCode: false };
  }

  // Anders: backup-code-pad (formaat XXXX-XXXX; streepje optioneel bij invoer).
  if (!args.backupCodesJson) return { valid: false, usedBackupCode: false };
  let hashes: string[];
  try {
    hashes = JSON.parse(args.backupCodesJson) as string[];
  } catch {
    return { valid: false, usedBackupCode: false };
  }

  const normalized = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      if (args.consumeForUserId) {
        const remaining = hashes.filter((_, idx) => idx !== i);
        await prisma.user.update({
          where: { id: args.consumeForUserId },
          data: { totpBackupCodes: JSON.stringify(remaining) },
        });
      }
      return { valid: true, usedBackupCode: true };
    }
  }
  return { valid: false, usedBackupCode: false };
}
