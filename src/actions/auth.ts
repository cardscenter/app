"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { signIn, auth } from "@/lib/auth";
import { AuthError } from "next-auth";
import { saveUploadedFile } from "@/lib/upload";
import { setupStaticShippingMethods } from "@/actions/shipping-method";
import {
  getCooldownRemaining,
  recordFailedAttempt,
  clearAttempts,
  extractIp,
} from "@/lib/auth/rate-limit";
import {
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "@/lib/email/send-email";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24u
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1u

function getPostRegisterRedirect(selectedPlan: string | null): string | undefined {
  if (selectedPlan === "PRO" || selectedPlan === "UNLIMITED") return "/dashboard/abonnement";
  if (selectedPlan === "ENTERPRISE") return "/dashboard/abonnement/enterprise-aanvraag";
  return undefined;
}

export async function register(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    displayName: formData.get("displayName") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    accountKind: formData.get("accountKind") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    city: formData.get("city") as string,
    country: formData.get("country") as string,
    companyName: (formData.get("companyName") as string) || "",
    cocNumber: (formData.get("cocNumber") as string) || "",
    vatNumber: (formData.get("vatNumber") as string) || "",
    street: (formData.get("street") as string) || "",
    houseNumber: (formData.get("houseNumber") as string) || "",
    postalCode: (formData.get("postalCode") as string) || "",
    avatarUrl: (formData.get("avatarUrl") as string) || "",
    accountFocus: formData.get("accountFocus") as string,
    referralSource: (formData.get("referralSource") as string) || "",
    termsAccepted: formData.get("termsAccepted") === "true" ? true as const : undefined,
  };

  const result = registerSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingEmail) {
    return { error: "Dit e-mailadres is al in gebruik" };
  }

  // Check if display name already exists
  const existingName = await prisma.user.findUnique({
    where: { displayName: data.displayName },
  });
  if (existingName) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  // Generate unique bank transfer reference: username + 7 digits + 3 letters (no ambiguous chars)
  const safeLetters = "ABCDEFGHJKMNPQRTUVWXY"; // no I, L, O, S, Z (look like 1, 1, 0, 5, 2)
  const digits = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  const letters = Array.from({ length: 3 }, () => safeLetters[Math.floor(Math.random() * safeLetters.length)]).join("");
  const bankTransferReference = `${data.displayName.toUpperCase().replace(/[^A-Z0-9]/g, "")}${digits}${letters}`;

  // Handle avatar file upload
  let avatarUrl: string | null = null;
  const avatarFile = formData.get("avatarFile") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    try {
      avatarUrl = await saveUploadedFile(avatarFile);
    } catch {
      // Avatar upload failure should not block registration
    }
  }

  const newUser = await prisma.user.create({
    data: {
      email: data.email,
      displayName: data.displayName,
      passwordHash,
      bankTransferReference,
      firstName: data.firstName,
      lastName: data.lastName,
      accountKind: data.accountKind,
      city: data.city,
      country: data.country,
      companyName: data.companyName || null,
      cocNumber: data.cocNumber || null,
      vatNumber: data.vatNumber || null,
      street: data.street || null,
      houseNumber: data.houseNumber || null,
      postalCode: data.postalCode || null,
      avatarUrl,
      accountFocus: data.accountFocus,
      referralSource: data.referralSource || null,
      termsAcceptedAt: new Date(),
    },
  });

  // Setup static shipping methods op basis van origin-country (Fase 33).
  await setupStaticShippingMethods(newUser.id);

  // Fase 37 — e-mailverificatie-token genereren + welkom + verify-link mails
  // versturen. Email-helper logt nu naar console (Fase 16 swap naar SMTP).
  try {
    const verificationToken = crypto.randomBytes(32).toString("base64url");
    await prisma.emailVerificationToken.create({
      data: {
        userId: newUser.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
      },
    });
    // Fire-and-forget — geen await zodat slow email-provider de register
    // niet vertraagt. Errors worden gelogd door sendEmail.
    void sendEmailVerificationEmail({
      to: newUser.email,
      displayName: newUser.displayName,
      token: verificationToken,
    });
    void sendWelcomeEmail({ to: newUser.email, displayName: newUser.displayName });
  } catch (err) {
    // E-mail/verify-token errors mogen registratie niet blokkeren — log alleen.
    console.error("[register] email-verification setup failed", err);
  }

  // Fase 37 — selectedPlan post-register redirect. PRO/UNLIMITED → abonnement,
  // ENTERPRISE → enterprise-aanvraag, FREE/null → caller-default (homepage).
  const selectedPlan = (formData.get("selectedPlan") as string | null) ?? null;
  const redirectTo = getPostRegisterRedirect(selectedPlan);

  // Auto sign in after registration (no redirect — handled client-side)
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Er is iets misgegaan bij het inloggen" };
    }
    // Don't rethrow — we handle redirect client-side
  }

  return { success: true, redirectTo };
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // rememberMe is geaccepteerd voor UI-affordance; functionele JWT-extensie
  // wacht op een NextAuth-callback uitbreiding (open follow-up).
  // const rememberMe = formData.get("rememberMe") === "on";

  // Rate-limiting: blokkeer als IP momenteel in cooldown zit (Fase 37).
  const requestHeaders = await headers();
  const ip = extractIp(requestHeaders);
  const cooldownMs = getCooldownRemaining(ip);
  if (cooldownMs > 0) {
    const minutes = Math.ceil(cooldownMs / 60000);
    return {
      error: `Te veel mislukte pogingen. Probeer opnieuw over ${minutes} minu${minutes === 1 ? "ut" : "ten"}.`,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const { cooldownActive, cooldownMs: newCooldown } = recordFailedAttempt(ip);
      if (cooldownActive) {
        const minutes = Math.ceil(newCooldown / 60000);
        return {
          error: `Te veel mislukte pogingen. Probeer opnieuw over ${minutes} minuten.`,
        };
      }
      return { error: "Ongeldige inloggegevens" };
    }
  }

  // Succesvolle login → reset attempts voor dit IP
  clearAttempts(ip);
  return { success: true };
}

/**
 * E-mailverificatie (Fase 42). Verzilvert de token uit de verificatie-mail.
 * Idempotent-vriendelijk: een al-geverifieerd account geeft gewoon succes.
 */
export async function verifyEmail(
  token: string,
): Promise<{ success: true } | { error: string }> {
  if (!token) return { error: "Ontbrekende of ongeldige verificatielink." };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!record) return { error: "Deze verificatielink is ongeldig." };
  if (record.user.emailVerifiedAt) return { success: true };
  if (record.usedAt) return { error: "Deze verificatielink is al gebruikt." };
  if (record.expiresAt < new Date()) {
    return { error: "Deze verificatielink is verlopen. Vraag een nieuwe aan." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}

/**
 * Opnieuw een verificatie-mail sturen (voor de "bevestig je e-mail"-banner).
 * Vereist een ingelogde, nog-niet-geverifieerde gebruiker.
 */
export async function resendVerificationEmail(): Promise<
  { success: true } | { error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Niet ingelogd." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, emailVerifiedAt: true },
  });
  if (!user) return { error: "Account niet gevonden." };
  if (user.emailVerifiedAt) return { success: true };

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    },
  });
  await sendEmailVerificationEmail({
    to: user.email,
    displayName: user.displayName,
    token,
  });
  return { success: true };
}

/**
 * Wachtwoord-reset aanvragen (Fase 42). Stuurt altijd dezelfde generieke
 * melding terug — geen account-enumeratie (we verklappen niet of het e-mailadres
 * bestaat).
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email) return { error: "Vul je e-mailadres in." };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true },
  });

  if (user) {
    try {
      const token = crypto.randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });
      await sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        token,
      });
    } catch (err) {
      console.error("[requestPasswordReset] failed", err);
      // Val toch generiek terug — verklap niets aan de aanvrager.
    }
  }

  return { success: true };
}

/**
 * Wachtwoord daadwerkelijk resetten via de token uit de reset-mail.
 */
export async function resetPassword(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const token = formData.get("token") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!token) return { error: "Ontbrekende of ongeldige reset-link." };
  if (!password || password.length < 8) {
    return { error: "Wachtwoord moet minstens 8 tekens zijn." };
  }
  if (password !== confirmPassword) {
    return { error: "De wachtwoorden komen niet overeen." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });
  if (!record || record.usedAt) {
    return { error: "Deze reset-link is ongeldig of al gebruikt." };
  }
  if (record.expiresAt < new Date()) {
    return { error: "Deze reset-link is verlopen. Vraag een nieuwe aan." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
