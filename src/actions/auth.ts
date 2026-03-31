"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function register(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    displayName: formData.get("displayName") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const result = registerSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { email, displayName, password } = result.data;

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { error: "Dit e-mailadres is al in gebruik" };
  }

  // Check if display name already exists
  const existingName = await prisma.user.findUnique({
    where: { displayName },
  });
  if (existingName) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate unique bank transfer reference
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  const bankTransferReference = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}${digits}`;

  await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      bankTransferReference,
    },
  });

  // Auto sign in after registration
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Er is iets misgegaan bij het inloggen" };
    }
    throw error; // Next.js redirect throws an error, so we rethrow
  }
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Ongeldige inloggegevens" };
    }
    throw error; // Next.js redirect throws an error, so we rethrow
  }
}
