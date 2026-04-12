import { prisma } from "@/lib/prisma";

// ============================================================
// ACHIEVEMENT DEFINITIONS (source of truth — DB is mirrored)
// ============================================================

export type AchievementCategory =
  | "ARCHIVE"   // longevity / account-age
  | "VAULT"     // purchase volume
  | "TRADER"    // sales activity
  | "SOCIAL"    // reviews
  | "MILESTONE" // login streak + other one-off
  | "FOUNDER";  // early adopter (time-bound)

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  threshold: number;
  rewardEmber?: number;
  rewardXP?: number;
  rewardCosmeticKey?: string;
  sortOrder: number;
}

// Cutoff: anyone registered on or before this date qualifies as Founder.
export const FOUNDER_CUTOFF_DATE = new Date("2026-06-01T00:00:00Z");

export const ACHIEVEMENTS: AchievementDef[] = [
  // ARCHIVE — longevity
  { key: "archive-first-week",    name: "First Week",          description: "7 dagen lid van Cards Center",        category: "ARCHIVE", threshold: 7,    rewardEmber: 50,   sortOrder: 10 },
  { key: "archive-one-month",     name: "One Month Deep",      description: "30 dagen lid",                        category: "ARCHIVE", threshold: 30,   rewardEmber: 100,  sortOrder: 11 },
  { key: "archive-three-months",  name: "Quarterly Collector", description: "90 dagen lid",                        category: "ARCHIVE", threshold: 90,   rewardEmber: 200,  sortOrder: 12 },
  { key: "archive-one-year",      name: "Veteran",             description: "1 jaar lid",                          category: "ARCHIVE", threshold: 365,  rewardEmber: 1000, rewardXP: 500, sortOrder: 13 },

  // VAULT — purchases
  { key: "vault-first-purchase",  name: "First Pull",          description: "Je eerste aankoop voltooid",          category: "VAULT",   threshold: 1,    rewardEmber: 25,   sortOrder: 20 },
  { key: "vault-ten-purchases",   name: "Active Collector",    description: "10 aankopen voltooid",                category: "VAULT",   threshold: 10,   rewardEmber: 100,  sortOrder: 21 },
  { key: "vault-fifty-purchases", name: "Binder Keeper",       description: "50 aankopen voltooid",                category: "VAULT",   threshold: 50,   rewardEmber: 500,  sortOrder: 22 },
  { key: "vault-100-spent",       name: "Hundred Club",        description: "€100 besteed op het platform",        category: "VAULT",   threshold: 100,  rewardEmber: 50,   sortOrder: 23 },
  { key: "vault-1000-spent",      name: "Grail Hunter",        description: "€1.000 besteed op het platform",      category: "VAULT",   threshold: 1000, rewardEmber: 500,  rewardXP: 250, sortOrder: 24 },
  { key: "vault-10000-spent",     name: "Vault Master",        description: "€10.000 besteed op het platform",     category: "VAULT",   threshold: 10000,rewardEmber: 2500, rewardXP: 1000, sortOrder: 25 },

  // TRADER — sales
  { key: "trader-first-sale",     name: "First Flip",          description: "Je eerste verkoop voltooid",          category: "TRADER",  threshold: 1,    rewardEmber: 25,   sortOrder: 30 },
  { key: "trader-ten-sales",      name: "Shop Open",           description: "10 verkopen voltooid",                category: "TRADER",  threshold: 10,   rewardEmber: 100,  sortOrder: 31 },
  { key: "trader-fifty-sales",    name: "Established Seller",  description: "50 verkopen voltooid",                category: "TRADER",  threshold: 50,   rewardEmber: 500,  rewardXP: 250, sortOrder: 32 },
  { key: "trader-100-sales",      name: "Master Trader",       description: "100 verkopen voltooid",               category: "TRADER",  threshold: 100,  rewardEmber: 1000, rewardXP: 500, sortOrder: 33 },
  { key: "trader-1000-earned",    name: "First Thousand",      description: "€1.000 verdiend aan verkopen",        category: "TRADER",  threshold: 1000, rewardEmber: 500,  sortOrder: 34 },

  // SOCIAL — reviews
  { key: "social-first-review",   name: "First Word",          description: "Je eerste review gegeven",            category: "SOCIAL",  threshold: 1,    rewardEmber: 15,   sortOrder: 40 },
  { key: "social-ten-reviews",    name: "Voice of the Guild",  description: "10 reviews gegeven",                  category: "SOCIAL",  threshold: 10,   rewardEmber: 100,  sortOrder: 41 },
  { key: "social-five-stars",     name: "Five-Star Seller",    description: "10× een 5-sterren review ontvangen",  category: "SOCIAL",  threshold: 10,   rewardEmber: 200,  rewardXP: 100, sortOrder: 42 },

  // MILESTONE — login streaks
  { key: "milestone-streak-7",    name: "Week Warrior",        description: "7 dagen op rij ingelogd",             category: "MILESTONE", threshold: 7,  rewardEmber: 50,   sortOrder: 50 },
  { key: "milestone-streak-14",   name: "Fortnight Fighter",   description: "14 dagen op rij ingelogd",            category: "MILESTONE", threshold: 14, rewardEmber: 150,  sortOrder: 51 },
  { key: "milestone-streak-28",   name: "Monthly Devotee",     description: "28 dagen op rij ingelogd",            category: "MILESTONE", threshold: 28, rewardEmber: 500,  rewardXP: 250, sortOrder: 52 },

  // FOUNDER — time-bound
  { key: "founder-member",        name: "Founder",             description: "Account aangemaakt voor de officiële launch", category: "FOUNDER", threshold: 1, rewardEmber: 500, rewardXP: 500, sortOrder: 60 },
];

export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

// ============================================================
// PROGRESS COMPUTATION
// ============================================================

async function fetchUserStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, loginStreak: true },
  });

  if (!user) return null;

  const [
    auctionPurchases,
    claimsalePurchases,
    listingPurchases,
    auctionSales,
    claimsaleSales,
    listingSales,
    reviewsGiven,
    fiveStarReceived,
  ] = await Promise.all([
    prisma.auction.findMany({
      where: { winnerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      select: { finalPrice: true },
    }),
    prisma.claimsaleItem.findMany({
      where: { buyerId: userId, status: "SOLD" },
      select: { price: true },
    }),
    prisma.shippingBundle.findMany({
      where: { buyerId: userId, status: "COMPLETED", listingId: { not: null } },
      select: { totalItemCost: true },
    }),
    prisma.auction.findMany({
      where: { sellerId: userId, status: { in: ["ENDED_SOLD", "BOUGHT_NOW"] } },
      select: { finalPrice: true },
    }),
    prisma.claimsaleItem.findMany({
      where: { claimsale: { sellerId: userId }, status: "SOLD" },
      select: { price: true },
    }),
    prisma.listing.findMany({
      where: { sellerId: userId, status: "SOLD" },
      select: { price: true },
    }),
    prisma.review.count({ where: { reviewerId: userId } }),
    prisma.review.count({ where: { sellerId: userId, rating: 5 } }),
  ]);

  const purchaseCount =
    auctionPurchases.length + claimsalePurchases.length + listingPurchases.length;
  const purchaseTotal =
    auctionPurchases.reduce((s, a) => s + (a.finalPrice ?? 0), 0) +
    claimsalePurchases.reduce((s, c) => s + c.price, 0) +
    listingPurchases.reduce((s, l) => s + l.totalItemCost, 0);

  const saleCount = auctionSales.length + claimsaleSales.length + listingSales.length;
  const saleTotal =
    auctionSales.reduce((s, a) => s + (a.finalPrice ?? 0), 0) +
    claimsaleSales.reduce((s, c) => s + c.price, 0) +
    listingSales.reduce((s, l) => s + (l.price ?? 0), 0);

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    createdAt: user.createdAt,
    accountAgeDays,
    loginStreak: user.loginStreak,
    purchaseCount,
    purchaseTotal: Math.floor(purchaseTotal),
    saleCount,
    saleTotal: Math.floor(saleTotal),
    reviewsGiven,
    fiveStarReceived,
  };
}

function computeProgress(
  def: AchievementDef,
  stats: Awaited<ReturnType<typeof fetchUserStats>>
): number {
  if (!stats) return 0;
  switch (def.key) {
    case "archive-first-week":
    case "archive-one-month":
    case "archive-three-months":
    case "archive-one-year":
      return stats.accountAgeDays;
    case "vault-first-purchase":
    case "vault-ten-purchases":
    case "vault-fifty-purchases":
      return stats.purchaseCount;
    case "vault-100-spent":
    case "vault-1000-spent":
    case "vault-10000-spent":
      return stats.purchaseTotal;
    case "trader-first-sale":
    case "trader-ten-sales":
    case "trader-fifty-sales":
    case "trader-100-sales":
      return stats.saleCount;
    case "trader-1000-earned":
      return stats.saleTotal;
    case "social-first-review":
    case "social-ten-reviews":
      return stats.reviewsGiven;
    case "social-five-stars":
      return stats.fiveStarReceived;
    case "milestone-streak-7":
    case "milestone-streak-14":
    case "milestone-streak-28":
      return stats.loginStreak;
    case "founder-member":
      return stats.createdAt <= FOUNDER_CUTOFF_DATE ? 1 : 0;
    default:
      return 0;
  }
}

// ============================================================
// CHECK & UNLOCK
// ============================================================

export interface UnlockResult {
  achievementKey: string;
  name: string;
  rewardEmber: number;
  rewardXP: number;
  rewardCosmeticKey: string | null;
}

/**
 * Recomputes all achievement progress for a user and unlocks any that hit their
 * threshold. Returns newly unlocked achievements so callers can notify the user.
 */
export async function checkAchievements(userId: string): Promise<UnlockResult[]> {
  const stats = await fetchUserStats(userId);
  if (!stats) return [];

  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementKey: true, unlockedAt: true },
  });
  const existingMap = new Map(existing.map((e) => [e.achievementKey, e]));

  const newlyUnlocked: UnlockResult[] = [];

  for (const def of ACHIEVEMENTS) {
    const progress = computeProgress(def, stats);
    const prior = existingMap.get(def.key);
    const alreadyUnlocked = !!prior?.unlockedAt;
    const reachedThreshold = progress >= def.threshold;

    if (alreadyUnlocked) {
      if (prior && progress !== undefined) {
        await prisma.userAchievement.update({
          where: { userId_achievementKey: { userId, achievementKey: def.key } },
          data: { progress },
        });
      }
      continue;
    }

    if (!reachedThreshold) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementKey: { userId, achievementKey: def.key } },
        create: { userId, achievementKey: def.key, progress },
        update: { progress },
      });
      continue;
    }

    // Unlock: mark and grant rewards atomically.
    await prisma.$transaction(async (tx) => {
      await tx.userAchievement.upsert({
        where: { userId_achievementKey: { userId, achievementKey: def.key } },
        create: {
          userId,
          achievementKey: def.key,
          progress,
          unlockedAt: new Date(),
        },
        update: { progress, unlockedAt: new Date() },
      });

      if (def.rewardEmber && def.rewardEmber > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { emberBalance: true },
        });
        const before = user?.emberBalance ?? 0;
        const after = before + def.rewardEmber;
        await tx.user.update({
          where: { id: userId },
          data: { emberBalance: after },
        });
        await tx.emberTransaction.create({
          data: {
            userId,
            amount: def.rewardEmber,
            type: "ACTIVITY_REWARD",
            description: `Achievement: ${def.name}`,
            balanceBefore: before,
            balanceAfter: after,
          },
        });
      }

      if (def.rewardXP && def.rewardXP > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { bonusXP: { increment: def.rewardXP } },
        });
      }

      if (def.rewardCosmeticKey) {
        const item = await tx.cosmeticItem.findUnique({
          where: { key: def.rewardCosmeticKey },
          select: { id: true },
        });
        if (item) {
          await tx.ownedItem.upsert({
            where: { userId_itemId: { userId, itemId: item.id } },
            create: { userId, itemId: item.id, source: "ACHIEVEMENT" },
            update: {},
          });
        }
      }
    });

    newlyUnlocked.push({
      achievementKey: def.key,
      name: def.name,
      rewardEmber: def.rewardEmber ?? 0,
      rewardXP: def.rewardXP ?? 0,
      rewardCosmeticKey: def.rewardCosmeticKey ?? null,
    });
  }

  return newlyUnlocked;
}

// ============================================================
// SEEDING (mirror code definitions to DB)
// ============================================================

/**
 * Upserts all code-defined achievements into the Achievement table.
 * Call at startup or from a seed script.
 */
export async function syncAchievementCatalog() {
  for (const def of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        threshold: def.threshold,
        rewardEmber: def.rewardEmber ?? null,
        rewardXP: def.rewardXP ?? null,
        rewardCosmeticKey: def.rewardCosmeticKey ?? null,
        sortOrder: def.sortOrder,
      },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        threshold: def.threshold,
        rewardEmber: def.rewardEmber ?? null,
        rewardXP: def.rewardXP ?? null,
        rewardCosmeticKey: def.rewardCosmeticKey ?? null,
        sortOrder: def.sortOrder,
      },
    });
  }
}

// ============================================================
// QUERY
// ============================================================

export async function getUserAchievements(userId: string) {
  const stats = await fetchUserStats(userId);
  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementKey: true, progress: true, unlockedAt: true },
  });
  const map = new Map(existing.map((e) => [e.achievementKey, e]));

  return ACHIEVEMENTS.map((def) => {
    const record = map.get(def.key);
    const progress = stats ? computeProgress(def, stats) : record?.progress ?? 0;
    return {
      ...def,
      progress: Math.min(progress, def.threshold),
      unlocked: !!record?.unlockedAt,
      unlockedAt: record?.unlockedAt ?? null,
    };
  });
}
