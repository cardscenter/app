"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoginStreakReward, LOGIN_STREAK_REWARDS } from "@/lib/cosmetic-config";
import { equipItemSchema, unequipSlotSchema } from "@/lib/validations/customization";
import { SELLER_LEVELS } from "@/lib/seller-levels";

// ============================================================
// EMBER BALANCE
// ============================================================

export async function getEmberBalance() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emberBalance: true },
  });
  return user?.emberBalance ?? 0;
}

// ============================================================
// LOGIN STREAK
// ============================================================

export async function getLoginStreakInfo() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loginStreak: true, lastLoginDate: true, emberBalance: true },
  });

  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];
  const alreadyClaimed = user.lastLoginDate === today;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const streakValid = user.lastLoginDate === yesterdayStr || user.lastLoginDate === today;
  const currentStreak = streakValid ? user.loginStreak : 0;
  const nextStreak = alreadyClaimed ? currentStreak : currentStreak + 1;
  const nextReward = getLoginStreakReward(nextStreak);

  return {
    currentStreak,
    nextStreak,
    nextReward,
    alreadyClaimed,
    rewards: LOGIN_STREAK_REWARDS as unknown as number[],
  };
}

export async function claimDailyLogin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loginStreak: true, lastLoginDate: true, emberBalance: true },
  });

  if (!user) return { error: "Gebruiker niet gevonden" };

  const today = new Date().toISOString().split("T")[0];

  if (user.lastLoginDate === today) {
    return { error: "Al geclaimd vandaag" };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const streakContinues = user.lastLoginDate === yesterdayStr;
  const newStreak = streakContinues ? user.loginStreak + 1 : 1;
  const reward = getLoginStreakReward(newStreak);

  const balanceBefore = user.emberBalance;
  const balanceAfter = balanceBefore + reward;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        loginStreak: newStreak,
        lastLoginDate: today,
        emberBalance: balanceAfter,
      },
    }),
    prisma.emberTransaction.create({
      data: {
        userId: session.user.id,
        amount: reward,
        type: "ACTIVITY_REWARD",
        description: `Dagelijkse login dag ${Math.min(newStreak, 7)}+ (${reward} Ember)`,
        balanceBefore,
        balanceAfter,
      },
    }),
  ]);

  return {
    success: true,
    reward,
    newStreak,
    newBalance: balanceAfter,
  };
}

// ============================================================
// INVENTORY & EQUIPPING
// ============================================================

export async function getOwnedItems(filters?: { type?: string; bundleId?: string }) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const where: Record<string, unknown> = { userId: session.user.id };
  const itemWhere: Record<string, unknown> = {};

  if (filters?.type) itemWhere.type = filters.type;
  if (filters?.bundleId) itemWhere.bundleId = filters.bundleId;

  return prisma.ownedItem.findMany({
    where: {
      ...where,
      item: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
    },
    include: {
      item: {
        include: { bundle: { select: { key: true, name: true } } },
      },
    },
    orderBy: { obtainedAt: "desc" },
  });
}

export async function equipItem(itemKey: string, slot: "banner" | "emblem" | "background") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = equipItemSchema.safeParse({ itemKey, slot });
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const levelBanner = SELLER_LEVELS.find((l) => l.nameKey === itemKey);
  if (levelBanner && slot === "banner") {
    const { getSellerStats } = await import("@/actions/review");
    const stats = await getSellerStats(session.user.id);
    if (!stats) return { error: "Kan stats niet laden" };

    if (stats.xp < levelBanner.minXP) {
      return { error: "Level niet ontgrendeld" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { profileBanner: itemKey },
    });

    return { success: true };
  }

  const item = await prisma.cosmeticItem.findUnique({
    where: { key: itemKey },
  });

  if (!item) return { error: "Item niet gevonden" };

  const owned = await prisma.ownedItem.findUnique({
    where: {
      userId_itemId: {
        userId: session.user.id,
        itemId: item.id,
      },
    },
  });

  if (!owned) return { error: "Je bezit dit item niet" };

  const fieldMap = {
    banner: "profileBanner",
    emblem: "profileEmblem",
    background: "profileBackground",
  } as const;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [fieldMap[slot]]: itemKey },
  });

  return { success: true };
}

export async function unequipSlot(slot: "banner" | "emblem" | "background") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = unequipSlotSchema.safeParse({ slot });
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const fieldMap = {
    banner: "profileBanner",
    emblem: "profileEmblem",
    background: "profileBackground",
  } as const;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { [fieldMap[slot]]: null },
  });

  return { success: true };
}

// ============================================================
// BUNDLES (Chapters)
// ============================================================

export async function getActiveBundles() {
  return prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}
