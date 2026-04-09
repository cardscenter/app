"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { saveUploadedFile } from "@/lib/upload";
import { getDefaultShippingMethods } from "@/lib/shipping/defaults";

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

  // Create default shipping methods based on user's country
  const defaults = getDefaultShippingMethods(data.country);
  if (defaults.length > 0) {
    await prisma.sellerShippingMethod.createMany({
      data: defaults.map((method) => ({
        sellerId: newUser.id,
        carrier: method.carrier,
        serviceName: method.serviceName,
        price: method.price,
        countries: JSON.stringify(method.countries),
        isDefault: true,
        isTracked: method.isTracked,
        isSigned: method.isSigned,
      })),
    });
  }

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

  return { success: true };
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Ongeldige inloggegevens" };
    }
  }

  return { success: true };
}
