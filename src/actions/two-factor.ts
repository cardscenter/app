"use server";

/**
 * Twee-factor-authenticatie via TOTP / authenticator-app (Fase 16-followup).
 *
 * Flow: startTotpEnrollment (secret + QR) → user scant in Google Authenticator
 * → confirmTotpEnrollment (6-cijfer code) → totpEnabled=true + 8 eenmalige
 * backup-codes (bcrypt-gehasht opgeslagen, plaintext één keer getoond).
 * Uitzetten vereist wachtwoord + geldige code (TOTP of backup).
 *
 * De login-verificatie zelf zit in src/lib/auth.ts (authorize) via
 * verifyTotpOrBackupCode in src/lib/two-factor.ts.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import {
  verifyTotpOrBackupCode,
  BACKUP_CODE_COUNT,
  TOTP_EPOCH_TOLERANCE_SECONDS,
} from "@/lib/two-factor";

/** Backup-code formaat XXXX-XXXX, alfabet zonder verwarrende tekens (0/O/1/I). */
function generateBackupCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
    if (i === 3) code += "-";
  }
  return code;
}

export async function startTotpEnrollment(): Promise<
  { qrDataUrl: string; secret: string } | { error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Niet ingelogd." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) return { error: "Account niet gevonden." };
  if (user.totpEnabled) return { error: "2FA staat al aan voor dit account." };

  // Secret alvast opslaan met totpEnabled=false — pas geldig na confirm.
  // Opnieuw starten overschrijft een eerdere onbevestigde poging.
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: secret, totpEnabled: false, totpBackupCodes: null },
  });

  const otpauthUrl = generateURI({
    issuer: "Cards Center",
    label: user.email,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });

  return { qrDataUrl, secret };
}

export async function confirmTotpEnrollment(
  code: string,
): Promise<{ backupCodes: string[] } | { error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Niet ingelogd." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpSecret) return { error: "Start eerst de 2FA-instelling opnieuw." };
  if (user.totpEnabled) return { error: "2FA staat al aan voor dit account." };

  const normalized = code.replace(/\s/g, "");
  const check = await verifyTotp({
    secret: user.totpSecret,
    token: normalized,
    epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
  });
  if (!check.valid) {
    return { error: "Ongeldige code. Controleer of je de juiste QR hebt gescand en probeer opnieuw." };
  }

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpBackupCodes: JSON.stringify(hashes) },
  });

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    "Twee-factor-authenticatie ingeschakeld",
    "2FA via een authenticator-app staat nu aan voor je account. Bij het inloggen wordt voortaan om een 6-cijferige code gevraagd. Was jij dit niet? Neem dan direct contact op via de site.",
    "/dashboard/profiel",
  );

  return { backupCodes };
}

export async function disableTotp(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Niet ingelogd." };

  const password = formData.get("password") as string | null;
  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!password) return { error: "Vul je wachtwoord in." };
  if (!code) return { error: "Vul een 2FA- of backup-code in." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpSecret: true, totpEnabled: true, totpBackupCodes: true },
  });
  if (!user?.totpEnabled || !user.totpSecret) {
    return { error: "2FA staat niet aan voor dit account." };
  }
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Wachtwoord is onjuist." };
  }

  const check = await verifyTotpOrBackupCode({
    code,
    totpSecret: user.totpSecret,
    backupCodesJson: user.totpBackupCodes,
  });
  if (!check.valid) return { error: "Ongeldige 2FA- of backup-code." };

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false, totpBackupCodes: null },
  });

  await createNotification(
    userId,
    "ACCOUNT_UPDATE",
    "Twee-factor-authenticatie uitgeschakeld",
    "2FA is uitgezet voor je account. Was jij dit niet? Reset dan direct je wachtwoord en neem contact op via de site.",
    "/dashboard/profiel",
  );

  return { success: true };
}
