"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTotpStepUp } from "@/lib/two-factor";

/**
 * Accountinstellingen (Community Hub, Fase 2): privacy-zichtbaarheid,
 * nieuwsbrief-opt-in en het verwijderen van het eigen account (AVG).
 */

export async function updatePrivacySettings(input: {
  showOnParticipantLists?: boolean;
  showOnLeaderboards?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const data: { showOnParticipantLists?: boolean; showOnLeaderboards?: boolean } = {};
  if (typeof input.showOnParticipantLists === "boolean") data.showOnParticipantLists = input.showOnParticipantLists;
  if (typeof input.showOnLeaderboards === "boolean") data.showOnLeaderboards = input.showOnLeaderboards;
  await prisma.user.update({ where: { id: session.user.id }, data });
  revalidatePath("/dashboard/instellingen");
  return { success: true };
}

export async function updateNewsletterOptIn(optIn: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { newsletterOptIn: optIn, newsletterOptInAt: optIn ? new Date() : null },
  });
  revalidatePath("/dashboard/instellingen");
  return { success: true };
}

/**
 * Eigen account verwijderen (AVG). De rij blijft bestaan (relaties, audit),
 * maar alle persoonsgegevens worden gewist en inloggen is onmogelijk.
 * Geblokkeerd zolang er geld of open handel op het account staat.
 */
export async function deleteOwnAccount(input: { password: string; confirmText: string; totpCode?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, accountType: true, balance: true, heldBalance: true, reservedBalance: true, displayName: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (user.accountType === "ADMIN") return { error: "Een admin-account kan niet zichzelf verwijderen. Laat een andere admin de rol eerst intrekken." };

  if (input.confirmText.trim().toUpperCase() !== "VERWIJDER") {
    return { error: "Typ VERWIJDER om te bevestigen" };
  }
  const ok = await bcrypt.compare(input.password ?? "", user.passwordHash);
  if (!ok) return { error: "Wachtwoord klopt niet" };

  const step = await requireTotpStepUp(userId, input.totpCode);
  if (step === "code_required") return { totpRequired: true as const, error: "Vul je 2FA-code in om te bevestigen" };
  if (step === "invalid") return { totpRequired: true as const, error: "Ongeldige 2FA-code" };

  // Open verplichtingen: geld op het account of lopende handel.
  if (user.balance > 0.009 || user.heldBalance > 0.009 || user.reservedBalance > 0.009) {
    return { error: "Er staat nog saldo op je account. Neem contact op met support om dit eerst af te handelen." };
  }
  const [openBundles, activeAuctions, activeListings, liveClaimsales] = await Promise.all([
    prisma.shippingBundle.count({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ["PENDING", "PAID", "SHIPPED", "SCHEDULED"] } },
    }),
    prisma.auction.count({ where: { sellerId: userId, status: { in: ["ACTIVE", "SCHEDULED", "AWAITING_PAYMENT", "AWAITING_RUNNER_UP_DECISION"] } } }),
    prisma.listing.count({ where: { sellerId: userId, status: { in: ["ACTIVE", "PAUSED", "RESERVED", "PARTIALLY_SOLD"] } } }),
    prisma.claimsale.count({ where: { sellerId: userId, status: { in: ["LIVE", "SCHEDULED"] } } }),
  ]);
  if (openBundles + activeAuctions + activeListings + liveClaimsales > 0) {
    return { error: "Je hebt nog lopende bestellingen of aanbod. Rond die eerst af of neem contact op met support." };
  }

  const suffix = randomBytes(6).toString("hex");
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${suffix}@deleted.invalid`,
        displayName: `verwijderd-${suffix}`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: null,
        lastName: null,
        bio: null,
        avatarUrl: null,
        coverImageUrl: null,
        websiteUrl: null,
        socialLinks: null,
        street: null,
        houseNumber: null,
        postalCode: null,
        city: null,
        country: null,
        companyName: null,
        vatNumber: null,
        cocNumber: null,
        iban: null,
        accountHolderName: null,
        dateOfBirth: null,
        favoriteGames: null,
        playerIds: null,
        guardianName: null,
        guardianEmail: null,
        guardianPhone: null,
        guardianConsentAt: null,
        newsletterOptIn: false,
        newsletterOptInAt: null,
        emailPreferences: null,
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: null,
        lastLoginIp: null,
        lastLoginIpAt: null,
        shopSlug: null,
        role: "PLAYER",
        deletedAt: now,
      },
    }),
    prisma.usernameHistory.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.guardianConsentToken.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.cardWatchlist.deleteMany({ where: { userId } }),
    prisma.watchlist.deleteMany({ where: { userId } }),
    prisma.userFollow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
  ]);

  await signOut({ redirect: false });
  return { success: true };
}
