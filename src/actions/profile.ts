"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload";
import { isValidIbanFormat, normalizeIban, IBAN_COOLDOWN_DAYS } from "@/lib/validations/iban";
import { z } from "zod";

const profileSchema = z.object({
  displayName: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  bio: z.string().max(500).optional(),
  defaultShippingCost: z.coerce.number().min(0),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const result = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    defaultShippingCost: formData.get("defaultShippingCost"),
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { displayName, bio } = result.data;

  // Check uniqueness if name changed
  const existing = await prisma.user.findUnique({ where: { displayName } });
  if (existing && existing.id !== session.user.id) {
    return { error: "Deze gebruikersnaam is al in gebruik" };
  }

  // Handle avatar upload
  let avatarUrl: string | undefined;
  const removeAvatar = formData.get("removeAvatar") === "true";

  if (removeAvatar) {
    avatarUrl = "";
  } else {
    const avatarFile = formData.get("avatarFile") as File | null;
    if (avatarFile && avatarFile.size > 0) {
      try {
        avatarUrl = await saveUploadedFile(avatarFile);
      } catch {
        return { error: "Profielfoto uploaden mislukt. Maximaal 5MB (JPG, PNG, WebP, GIF)." };
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      displayName,
      bio: bio ?? null,
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
    select: { avatarUrl: true },
  });

  return { success: true, avatarUrl: updated.avatarUrl };
}

export async function updateProfileBanner(bannerKey: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Validate that bannerKey is a valid seller level nameKey (or null to remove)
  if (bannerKey !== null) {
    const { SELLER_LEVELS } = await import("@/lib/seller-levels");
    const validKeys = SELLER_LEVELS.map((l) => l.nameKey);
    if (!validKeys.includes(bannerKey)) {
      return { error: "Ongeldige banner" };
    }

    // Check if user has unlocked this tier
    const { getSellerStats } = await import("@/actions/review");
    const stats = await getSellerStats(session.user.id);
    if (!stats) return { error: "Kan verkopersstats niet ophalen" };

    const { getLevel } = await import("@/lib/seller-levels");
    const currentLevel = getLevel(stats.xp);
    const currentLevelIndex = SELLER_LEVELS.findIndex((l) => l.nameKey === currentLevel.nameKey);
    const requestedLevelIndex = SELLER_LEVELS.findIndex((l) => l.nameKey === bannerKey);

    if (requestedLevelIndex > currentLevelIndex) {
      return { error: "Je hebt deze rank nog niet bereikt" };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profileBanner: bannerKey },
  });

  return { success: true };
}

const bankDetailsSchema = z.object({
  iban: z.string().min(1, "IBAN is verplicht"),
  accountHolderName: z.string().min(2, "Naam rekeninghouder is verplicht").max(100),
});

export async function updateBankDetails(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const result = bankDetailsSchema.safeParse({
    iban: formData.get("iban"),
    accountHolderName: formData.get("accountHolderName"),
  });
  if (!result.success) return { error: result.error.issues[0].message };

  const iban = normalizeIban(result.data.iban);
  if (!isValidIbanFormat(iban)) {
    return { error: "Ongeldig IBAN-formaat" };
  }
  const accountHolderName = result.data.accountHolderName.trim();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { iban: true, accountHolderName: true, lastIbanChange: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // No-op early return: nothing to save.
  if (user.iban === iban && user.accountHolderName === accountHolderName) {
    return { success: true, unchanged: true };
  }

  // First-time set is free; subsequent changes are cooldown-capped. We only
  // gate IBAN changes (not name-only edits) since the name doesn't change
  // where the money lands. If both fields change, we treat it as an IBAN
  // change for cooldown purposes.
  const isIbanChange = user.iban !== null && user.iban !== iban;
  if (isIbanChange && user.lastIbanChange) {
    const daysSince = (Date.now() - user.lastIbanChange.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < IBAN_COOLDOWN_DAYS) {
      const daysRemaining = Math.ceil(IBAN_COOLDOWN_DAYS - daysSince);
      return {
        error: `Je kunt je IBAN pas over ${daysRemaining} dag${daysRemaining === 1 ? "" : "en"} weer wijzigen.`,
        daysRemaining,
      };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      iban,
      accountHolderName,
      ...(isIbanChange ? { lastIbanChange: new Date() } : {}),
    },
  });

  return { success: true };
}

export async function updateMaxRunnerUpAttempts(value: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return { error: "Waarde moet tussen 1 en 10 liggen" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { maxRunnerUpAttempts: value },
  });

  return { success: true };
}
