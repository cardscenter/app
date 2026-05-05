"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_TIERS,
  getMonthlyFreeUpsells,
  getTierRank,
  type TierKey,
  type BillingCycle,
} from "@/lib/subscription-tiers";

export async function getSubscriptionInfo() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, premiumExpiresAt: true },
  });
  if (!user) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  // ADMIN mapt naar ENTERPRISE-config sinds Fase 31 (was UNLIMITED). Houd
  // dit consistent met getTierConfig in subscription-tiers.ts.
  const tierKey = (user.accountType === "ADMIN" ? "ENTERPRISE" : user.accountType) as TierKey;
  const tierConfig = ACCOUNT_TIERS[tierKey] ?? ACCOUNT_TIERS.FREE;

  return {
    accountType: user.accountType,
    tier: tierConfig,
    subscription: subscription
      ? {
          id: subscription.id,
          tier: subscription.tier,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          startsAt: subscription.startsAt,
          expiresAt: subscription.expiresAt,
          monthlyPrice: subscription.monthlyPrice,
          yearlyPrice: subscription.yearlyPrice,
        }
      : null,
  };
}

// Admin or system action: upgrade a user to a tier
//
// `customMonthlyPrice` (Fase 31): Enterprise-aanvragen kunnen op een
// custom-prijs goedgekeurd worden via het admin-panel. Voor PRO/UNLIMITED
// blijft de tier-config de bron-van-waarheid.
export async function upgradeToTier(
  userId: string,
  tier: "PRO" | "UNLIMITED" | "ENTERPRISE",
  billingCycle: BillingCycle,
  customMonthlyPrice?: number
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const tierConfig = ACCOUNT_TIERS[tier];
  const now = new Date();
  const expiresAt = new Date(now);

  if (billingCycle === "YEARLY") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const monthlyPrice = customMonthlyPrice ?? tierConfig.monthlyPrice;
  const yearlyPrice = billingCycle === "YEARLY"
    ? (tierConfig.yearlyPrice ?? monthlyPrice * 12)
    : null;

  // Cancel any existing active subscription
  await prisma.subscription.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "CANCELLED", cancelledAt: now },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        accountType: tier,
        premiumExpiresAt: expiresAt,
        // Tier-search-boost denormalisatie (stap 8)
        tierRank: getTierRank(tier),
        // Direct quota toekennen zodat user meteen kan profiteren — geen
        // wacht-tot-volgende-maand
        freeUpsellsRemaining: getMonthlyFreeUpsells(tier),
        freeUpsellsResetAt: now,
      },
    }),
    prisma.subscription.create({
      data: {
        userId,
        tier,
        billingCycle,
        status: "ACTIVE",
        startsAt: now,
        expiresAt,
        monthlyPrice,
        yearlyPrice,
      },
    }),
  ]);

  return { success: true, expiresAt };
}

// Cancel subscription — keeps active until expiresAt
export async function cancelSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) return { error: "Geen actief abonnement gevonden" };

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  return { success: true, expiresAt: subscription.expiresAt };
}

// Cron: downgrade expired subscriptions back to FREE
export async function checkAndDowngradeExpired(): Promise<{ downgraded: number }> {
  const now = new Date();

  // Find users with expired premium
  const expiredUsers = await prisma.user.findMany({
    where: {
      accountType: { in: ["PRO", "UNLIMITED"] },
      premiumExpiresAt: { lt: now },
    },
    select: { id: true },
  });

  if (expiredUsers.length === 0) return { downgraded: 0 };

  const userIds = expiredUsers.map((u) => u.id);

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        accountType: "FREE",
        premiumExpiresAt: null,
        tierRank: 1,
        freeUpsellsRemaining: 0,
        freeUpsellsResetAt: null,
      },
    }),
    prisma.subscription.updateMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    }),
  ]);

  return { downgraded: expiredUsers.length };
}
