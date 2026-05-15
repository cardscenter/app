"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { saveUploadedFile } from "@/lib/upload";
import { setupStaticShippingMethods } from "@/actions/shipping-method";
import {
  getCooldownRemaining,
  recordFailedAttempt,
  clearAttempts,
  extractIp,
} from "@/lib/auth/rate-limit";
import { sendEmailVerificationEmail, sendWelcomeEmail } from "@/lib/email/send-email";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24u

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
