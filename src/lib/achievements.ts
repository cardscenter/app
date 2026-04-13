import { prisma } from "@/lib/prisma";

// ============================================================
// TIERED ACHIEVEMENT DEFINITIONS (source of truth — DB is mirrored)
// ============================================================

export type AchievementCategory =
  | "ARCHIVE"   // longevity / account-age
  | "VAULT"     // purchase volume
  | "TRADER"    // sales activity
  | "SOCIAL"    // reviews
  | "MILESTONE" // login streak, one-offs
  | "FOUNDER";  // early adopter (time-bound)

// Metric keys map to values computed in fetchUserStats(); used to wire each
// achievement to the stat it tracks.
export type MetricKey =
  | "accountAgeDays"
  | "loginStreak"
  | "purchaseCount"
  | "purchaseTotal"
  | "saleCount"
  | "saleTotal"
  | "reviewsGiven"
  | "fiveStarReceived"
  | "isFounder";

export interface TierDef {
  tier: number;          // 1..N
  threshold: number;
  rewardEmber?: number;
  rewardXP?: number;
  rewardCosmeticKey?: string;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  metric: MetricKey;
  sortOrder: number;
  tiers: TierDef[];
}

// Anyone registered on or before this date qualifies as Founder.
export const FOUNDER_CUTOFF_DATE = new Date("2026-06-01T00:00:00Z");

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- ARCHIVE ---
  {
    key: "days-online",
    name: "Days on Cards Center",
    description: "Totaal aantal dagen dat je account bestaat",
    category: "ARCHIVE",
    metric: "accountAgeDays",
    sortOrder: 10,
    tiers: [
      { tier: 1, threshold: 7,   rewardEmber: 25 },
      { tier: 2, threshold: 30,  rewardEmber: 75 },
      { tier: 3, threshold: 90,  rewardEmber: 200 },
      { tier: 4, threshold: 180, rewardEmber: 500,  rewardXP: 250 },
      { tier: 5, threshold: 365, rewardEmber: 1000, rewardXP: 500 },
    ],
  },

  // --- VAULT ---
  {
    key: "purchases-completed",
    name: "Purchases Completed",
    description: "Aantal afgeronde aankopen",
    category: "VAULT",
    metric: "purchaseCount",
    sortOrder: 20,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 25 },
      { tier: 2, threshold: 10,  rewardEmber: 100 },
      { tier: 3, threshold: 25,  rewardEmber: 250 },
      { tier: 4, threshold: 50,  rewardEmber: 500 },
      { tier: 5, threshold: 100, rewardEmber: 1000, rewardXP: 500 },
    ],
  },
  {
    key: "total-spent",
    name: "Total Spent",
    description: "Totaalbedrag aan voltooide aankopen (€)",
    category: "VAULT",
    metric: "purchaseTotal",
    sortOrder: 21,
    tiers: [
      { tier: 1, threshold: 100,   rewardEmber: 50 },
      { tier: 2, threshold: 500,   rewardEmber: 200 },
      { tier: 3, threshold: 1000,  rewardEmber: 500 },
      { tier: 4, threshold: 5000,  rewardEmber: 1500, rewardXP: 500 },
      { tier: 5, threshold: 10000, rewardEmber: 3000, rewardXP: 1000 },
    ],
  },

  // --- TRADER ---
  {
    key: "sales-completed",
    name: "Sales Completed",
    description: "Aantal afgeronde verkopen",
    category: "TRADER",
    metric: "saleCount",
    sortOrder: 30,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 25 },
      { tier: 2, threshold: 10,  rewardEmber: 100 },
      { tier: 3, threshold: 25,  rewardEmber: 300 },
      { tier: 4, threshold: 50,  rewardEmber: 600, rewardXP: 250 },
      { tier: 5, threshold: 100, rewardEmber: 1200, rewardXP: 500 },
    ],
  },
  {
    key: "total-earned",
    name: "Total Earned",
    description: "Totaalbedrag aan verkopen (€)",
    category: "TRADER",
    metric: "saleTotal",
    sortOrder: 31,
    tiers: [
      { tier: 1, threshold: 100,   rewardEmber: 50 },
      { tier: 2, threshold: 1000,  rewardEmber: 300 },
      { tier: 3, threshold: 5000,  rewardEmber: 1000 },
      { tier: 4, threshold: 25000, rewardEmber: 2500, rewardXP: 1000 },
      { tier: 5, threshold: 50000, rewardEmber: 5000, rewardXP: 2000 },
    ],
  },

  // --- SOCIAL ---
  {
    key: "reviews-given",
    name: "Reviews Given",
    description: "Aantal reviews dat je geschreven hebt",
    category: "SOCIAL",
    metric: "reviewsGiven",
    sortOrder: 40,
    tiers: [
      { tier: 1, threshold: 1,   rewardEmber: 15 },
      { tier: 2, threshold: 10,  rewardEmber: 75 },
      { tier: 3, threshold: 25,  rewardEmber: 200 },
      { tier: 4, threshold: 50,  rewardEmber: 400 },
      { tier: 5, threshold: 100, rewardEmber: 800, rewardXP: 250 },
    ],
  },
  {
    key: "five-stars-received",
    name: "Five-Star Reviews Received",
    description: "Aantal 5-sterren reviews die je hebt ontvangen",
    category: "SOCIAL",
    metric: "fiveStarReceived",
    sortOrder: 41,
    tiers: [
      { tier: 1, threshold: 1,  rewardEmber: 25 },
      { tier: 2, threshold: 10, rewardEmber: 150 },
      { tier: 3, threshold: 25, rewardEmber: 400 },
      { tier: 4, threshold: 50, rewardEmber: 800, rewardXP: 250 },
      { tier: 5, threshold: 100,rewardEmber: 1500, rewardXP: 500 },
    ],
  },

  // --- MILESTONE ---
  {
    key: "login-streak",
    name: "Login Streak",
    description: "Aaneengesloten dagen ingelogd",
    category: "MILESTONE",
    metric: "loginStreak",
    sortOrder: 50,
    tiers: [
      { tier: 1, threshold: 3,  rewardEmber: 25 },
      { tier: 2, threshold: 7,  rewardEmber: 75 },
      { tier: 3, threshold: 14, rewardEmber: 200 },
      { tier: 4, threshold: 21, rewardEmber: 350 },
      { tier: 5, threshold: 28, rewardEmber: 750, rewardXP: 250 },
    ],
  },

  // --- FOUNDER ---
  {
    key: "founder-member",
    name: "Founder",
    description: "Account aangemaakt voor de officiële launch",
    category: "FOUNDER",
    metric: "isFounder",
    sortOrder: 60,
    tiers: [
      { tier: 1, threshold: 1, rewardEmber: 500, rewardXP: 500 },
    ],
  },
];

export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

// ============================================================
// STATS COMPUTATION
// ============================================================

type UserStats = {
  accountAgeDays: number;
  loginStreak: number;
  purchaseCount: number;
  purchaseTotal: number;
  saleCount: number;
  saleTotal: number;
  reviewsGiven: number;
  fiveStarReceived: number;
  isFounder: number;
};

async function fetchUserStats(userId: string): Promise<UserStats | null> {
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
    accountAgeDays,
    loginStreak: user.loginStreak,
    purchaseCount,
    purchaseTotal: Math.floor(purchaseTotal),
    saleCount,
    saleTotal: Math.floor(saleTotal),
    reviewsGiven,
    fiveStarReceived,
    isFounder: user.createdAt <= FOUNDER_CUTOFF_DATE ? 1 : 0,
  };
}

function metricValue(def: AchievementDef, stats: UserStats): number {
  return stats[def.metric];
}

function tierForProgress(def: AchievementDef, progress: number): number {
  let reached = 0;
  for (const t of def.tiers) {
    if (progress >= t.threshold) reached = t.tier;
  }
  return reached;
}

// ============================================================
// CHECK & UNLOCK
// ============================================================

export interface TierUnlock {
  achievementKey: string;
  achievementName: string;
  tier: number;
  rewardEmber: number;
  rewardXP: number;
  rewardCosmeticKey: string | null;
}

/**
 * Recomputes progress for all achievements and promotes the user through any
 * newly-reached tiers. Returns every tier that unlocked during this call so
 * callers can show a celebration.
 */
export async function checkAchievements(userId: string): Promise<TierUnlock[]> {
  const stats = await fetchUserStats(userId);
  if (!stats) return [];

  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementKey: true, currentTier: true },
  });
  const existingMap = new Map(existing.map((e) => [e.achievementKey, e.currentTier]));

  const newlyUnlocked: TierUnlock[] = [];

  for (const def of ACHIEVEMENTS) {
    const progress = metricValue(def, stats);
    const reachedTier = tierForProgress(def, progress);
    const priorTier = existingMap.get(def.key) ?? 0;

    if (reachedTier === priorTier) {
      // No tier change — still update raw progress for display.
      await prisma.userAchievement.upsert({
        where: { userId_achievementKey: { userId, achievementKey: def.key } },
        create: { userId, achievementKey: def.key, currentTier: reachedTier, progress },
        update: { progress },
      });
      continue;
    }

    // Promoted — grant rewards for every newly-crossed tier (priorTier+1 .. reachedTier).
    const tiersToGrant = def.tiers.filter(
      (t) => t.tier > priorTier && t.tier <= reachedTier
    );

    await prisma.$transaction(async (tx) => {
      await tx.userAchievement.upsert({
        where: { userId_achievementKey: { userId, achievementKey: def.key } },
        create: {
          userId,
          achievementKey: def.key,
          currentTier: reachedTier,
          progress,
          lastUnlockedAt: new Date(),
        },
        update: {
          currentTier: reachedTier,
          progress,
          lastUnlockedAt: new Date(),
        },
      });

      for (const t of tiersToGrant) {
        if (t.rewardEmber && t.rewardEmber > 0) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { emberBalance: true },
          });
          const before = user?.emberBalance ?? 0;
          const after = before + t.rewardEmber;
          await tx.user.update({
            where: { id: userId },
            data: { emberBalance: after },
          });
          await tx.emberTransaction.create({
            data: {
              userId,
              amount: t.rewardEmber,
              type: "ACTIVITY_REWARD",
              description: `Achievement: ${def.name} — Tier ${t.tier}`,
              balanceBefore: before,
              balanceAfter: after,
            },
          });
        }

        if (t.rewardXP && t.rewardXP > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { bonusXP: { increment: t.rewardXP } },
          });
        }

        if (t.rewardCosmeticKey) {
          const item = await tx.cosmeticItem.findUnique({
            where: { key: t.rewardCosmeticKey },
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
      }
    });

    for (const t of tiersToGrant) {
      newlyUnlocked.push({
        achievementKey: def.key,
        achievementName: def.name,
        tier: t.tier,
        rewardEmber: t.rewardEmber ?? 0,
        rewardXP: t.rewardXP ?? 0,
        rewardCosmeticKey: t.rewardCosmeticKey ?? null,
      });
    }
  }

  return newlyUnlocked;
}

// ============================================================
// QUERY
// ============================================================

export interface AchievementWithProgress {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  sortOrder: number;
  tiers: TierDef[];
  progress: number;        // raw metric value (capped at max threshold)
  currentTier: number;     // 0 if none unlocked
  maxTier: number;
  nextTier: TierDef | null; // null if all tiers unlocked
  nextTierProgressPercent: number; // 0-100 toward next tier (100 if maxed)
}

export async function getUserAchievements(
  userId: string
): Promise<AchievementWithProgress[]> {
  const stats = await fetchUserStats(userId);

  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementKey: true, currentTier: true, progress: true },
  });
  const map = new Map(
    existing.map((e) => [e.achievementKey, e])
  );

  return ACHIEVEMENTS.map((def): AchievementWithProgress => {
    const record = map.get(def.key);
    const rawProgress = stats ? metricValue(def, stats) : record?.progress ?? 0;
    const currentTier = tierForProgress(def, rawProgress);
    const maxTier = def.tiers.length;
    const maxThreshold = def.tiers[maxTier - 1].threshold;
    const displayProgress = Math.min(rawProgress, maxThreshold);

    const nextTier = def.tiers.find((t) => t.tier === currentTier + 1) ?? null;

    let nextTierProgressPercent = 100;
    if (nextTier) {
      const prevThreshold =
        currentTier === 0 ? 0 : def.tiers[currentTier - 1].threshold;
      const range = nextTier.threshold - prevThreshold;
      const within = rawProgress - prevThreshold;
      nextTierProgressPercent = range > 0
        ? Math.max(0, Math.min(100, Math.round((within / range) * 100)))
        : 100;
    }

    return {
      key: def.key,
      name: def.name,
      description: def.description,
      category: def.category,
      sortOrder: def.sortOrder,
      tiers: def.tiers,
      progress: displayProgress,
      currentTier,
      maxTier,
      nextTier,
      nextTierProgressPercent,
    };
  });
}

// ============================================================
// SEEDING (mirror code definitions to DB)
// ============================================================

export async function syncAchievementCatalog() {
  for (const def of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        sortOrder: def.sortOrder,
      },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        sortOrder: def.sortOrder,
      },
    });

    // Replace tiers for this achievement.
    await prisma.achievementTier.deleteMany({
      where: { achievementKey: def.key },
    });
    for (const t of def.tiers) {
      await prisma.achievementTier.create({
        data: {
          achievementKey: def.key,
          tier: t.tier,
          threshold: t.threshold,
          rewardEmber: t.rewardEmber ?? null,
          rewardXP: t.rewardXP ?? null,
          rewardCosmeticKey: t.rewardCosmeticKey ?? null,
        },
      });
    }
  }
}
