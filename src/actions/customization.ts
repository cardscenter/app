"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMBER_CONFIG, getRarity, getLoginStreakReward, LOGIN_STREAK_REWARDS } from "@/lib/cosmetic-config";
import {
  purchaseEmberSchema,
  openLootboxSchema,
  recycleDuplicateSchema,
  equipItemSchema,
  unequipSlotSchema,
} from "@/lib/validations/customization";
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

  // Check if streak is still valid (yesterday or today)
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

  // Already claimed today
  if (user.lastLoginDate === today) {
    return { error: "Al geclaimd vandaag" };
  }

  // Check if streak continues (last login was yesterday)
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
// EMBER PURCHASE
// ============================================================

// Volume bonus tiers (server-side source of truth)
const PURCHASE_BONUSES: Record<number, number> = {
  500: 5,
  1000: 10,
  2500: 15,
  5000: 20,
};

function getBonusPercent(baseAmount: number): number {
  let bonus = 0;
  for (const [threshold, pct] of Object.entries(PURCHASE_BONUSES)) {
    if (baseAmount >= Number(threshold)) bonus = pct;
  }
  return bonus;
}

export async function purchaseEmber(baseAmount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = purchaseEmberSchema.safeParse({ amount: baseAmount });
  if (!parsed.success) return { error: "Ongeldig bedrag" };

  // Only PRO and UNLIMITED (and ADMIN) can purchase Ember
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true, emberBalance: true, accountType: true },
  });

  if (!user) return { error: "Gebruiker niet gevonden" };

  if (user.accountType === "FREE") {
    return { error: "Ember kopen is beschikbaar vanaf PRO" };
  }

  // Calculate bonus server-side (prevents client manipulation)
  const bonusPct = getBonusPercent(baseAmount);
  const bonusAmount = Math.floor(baseAmount * (bonusPct / 100));
  const totalEmber = baseAmount + bonusAmount;

  // EUR cost is only on base amount — bonus is free
  const eurCost = baseAmount / EMBER_CONFIG.eurToEmber;

  const availableBalance = user.balance - user.reservedBalance;
  if (availableBalance < eurCost) return { error: "Onvoldoende saldo" };

  const balanceBefore = user.emberBalance;
  const balanceAfter = balanceBefore + totalEmber;

  const bonusText = bonusAmount > 0 ? ` (+${bonusAmount} bonus)` : "";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        balance: { decrement: eurCost },
        emberBalance: balanceAfter,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "PURCHASE",
        amount: -eurCost,
        balanceBefore: user.balance,
        balanceAfter: user.balance - eurCost,
        description: `${totalEmber} Ember gekocht${bonusText}`,
      },
    }),
    prisma.emberTransaction.create({
      data: {
        userId: session.user.id,
        amount: totalEmber,
        type: "WALLET_PURCHASE",
        description: `${totalEmber} Ember gekocht voor €${eurCost.toFixed(2)}${bonusText}`,
        balanceBefore,
        balanceAfter,
      },
    }),
  ]);

  return { success: true, newBalance: balanceAfter };
}

// ============================================================
// LOOTBOX
// ============================================================

export async function openLootbox(lootboxId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const parsed = openLootboxSchema.safeParse({ lootboxId });
  if (!parsed.success) return { error: "Ongeldige lootbox" };

  const lootbox = await prisma.lootbox.findUnique({
    where: { id: lootboxId, isActive: true },
    include: {
      items: { include: { item: true } },
    },
  });

  if (!lootbox) return { error: "Lootbox niet gevonden" };
  if (lootbox.items.length === 0) return { error: "Lootbox is leeg" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emberBalance: true },
  });

  if (!user) return { error: "Gebruiker niet gevonden" };
  if (user.emberBalance < lootbox.emberCost) return { error: "Niet genoeg Ember" };

  // Weighted random selection
  const resultItem = selectRandomItem(lootbox);

  // Check for duplicate
  const existing = await prisma.ownedItem.findUnique({
    where: {
      userId_itemId: {
        userId,
        itemId: resultItem.id,
      },
    },
  });

  const wasDuplicate = !!existing;
  const balanceBefore = user.emberBalance;
  const balanceAfter = balanceBefore - lootbox.emberCost;

  // Deduct Ember and create opening record
  const opening = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { emberBalance: balanceAfter },
    });

    await tx.emberTransaction.create({
      data: {
        userId,
        amount: -lootbox.emberCost,
        type: "LOOTBOX_SPEND",
        description: `${lootbox.name} geopend`,
        balanceBefore,
        balanceAfter,
      },
    });

    // Handle reward types (Ember/XP) — credit immediately, don't add to inventory
    if (resultItem.type === "EMBER_REWARD" && resultItem.rewardValue) {
      const rewardEmber = resultItem.rewardValue;
      await tx.user.update({
        where: { id: userId },
        data: { emberBalance: { increment: rewardEmber } },
      });
      await tx.emberTransaction.create({
        data: {
          userId,
          amount: rewardEmber,
          type: "LOOTBOX_SPEND",
          description: `${resultItem.name} uit ${lootbox.name}`,
          balanceBefore: balanceAfter,
          balanceAfter: balanceAfter + rewardEmber,
        },
      });
    } else if (resultItem.type === "XP_REWARD" && resultItem.rewardValue) {
      await tx.user.update({
        where: { id: userId },
        data: { bonusXP: { increment: resultItem.rewardValue } },
      });
    } else if (!wasDuplicate) {
      // Add cosmetic to owned items if not duplicate
      await tx.ownedItem.create({
        data: {
          userId,
          itemId: resultItem.id,
          source: "LOOTBOX",
        },
      });
    }

    return tx.lootboxOpening.create({
      data: {
        userId,
        lootboxId: lootbox.id,
        resultItemId: resultItem.id,
        wasDuplicate,
      },
    });
  });

  // Build carousel decoys (20-30 items with realistic rarity distribution)
  const decoyCount = 25;
  const carouselItems = buildCarousel(lootbox, resultItem, decoyCount);

  return {
    success: true,
    openingId: opening.id,
    resultItem: {
      id: resultItem.id,
      key: resultItem.key,
      type: resultItem.type,
      name: resultItem.name,
      rarity: resultItem.rarity,
      assetPath: resultItem.assetPath,
      rewardValue: resultItem.rewardValue,
      artistKey: resultItem.artistKey,
    },
    wasDuplicate,
    carouselItems,
    resultIndex: Math.floor(decoyCount * 0.8), // Place result near the end
    newEmberBalance: resultItem.type === "EMBER_REWARD" && resultItem.rewardValue
      ? balanceAfter + resultItem.rewardValue
      : balanceAfter,
    lootboxCost: lootbox.emberCost,
  };
}

function selectRandomItem(lootbox: {
  weightUncommon: number;
  weightRare: number;
  weightEpic: number;
  weightLegendary: number;
  weightUnique: number;
  weightShiny: number;
  items: Array<{ item: { id: string; key: string; type: string; name: string; rarity: string; assetPath: string | null; rewardValue: number | null; weight: number; artistKey: string | null } }>;
}) {
  const items = lootbox.items.map((li) => li.item);

  // Step 1: Pick a rarity tier
  const totalWeight =
    lootbox.weightUncommon +
    lootbox.weightRare +
    lootbox.weightEpic +
    lootbox.weightLegendary +
    lootbox.weightUnique +
    lootbox.weightShiny;

  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  let roll = randomBytes[0] % totalWeight;

  let selectedRarity: string;
  if (roll < lootbox.weightUncommon) {
    selectedRarity = "UNCOMMON";
  } else if ((roll -= lootbox.weightUncommon) < lootbox.weightRare) {
    selectedRarity = "RARE";
  } else if ((roll -= lootbox.weightRare) < lootbox.weightEpic) {
    selectedRarity = "EPIC";
  } else if ((roll -= lootbox.weightEpic) < lootbox.weightLegendary) {
    selectedRarity = "LEGENDARY";
  } else if ((roll -= lootbox.weightLegendary) < lootbox.weightUnique) {
    selectedRarity = "UNIQUE";
  } else {
    selectedRarity = "SHINY";
  }

  // Step 2: Pick an item within that rarity tier
  const tierItems = items.filter((i) => i.rarity === selectedRarity);

  // Fallback: if no items in selected rarity, pick from all items
  const pool = tierItems.length > 0 ? tierItems : items;

  const totalItemWeight = pool.reduce((sum, i) => sum + i.weight, 0);
  const randomBytes2 = new Uint32Array(1);
  crypto.getRandomValues(randomBytes2);
  let itemRoll = randomBytes2[0] % totalItemWeight;

  for (const item of pool) {
    if (itemRoll < item.weight) return item;
    itemRoll -= item.weight;
  }

  return pool[pool.length - 1];
}

function buildCarousel(
  lootbox: {
    items: Array<{ item: { id: string; key: string; name: string; rarity: string; type: string; assetPath: string | null; artistKey: string | null } }>;
  },
  resultItem: { id: string; key: string; name: string; rarity: string; type: string; assetPath: string | null; artistKey: string | null },
  count: number
) {
  const allItems = lootbox.items.map((li) => ({
    id: li.item.id,
    key: li.item.key,
    name: li.item.name,
    rarity: li.item.rarity,
    type: li.item.type,
    assetPath: li.item.assetPath,
    artistKey: li.item.artistKey,
  }));

  const carousel = [];
  const resultIndex = Math.floor(count * 0.8);

  for (let i = 0; i < count; i++) {
    if (i === resultIndex) {
      carousel.push({
        id: resultItem.id,
        key: resultItem.key,
        name: resultItem.name,
        rarity: resultItem.rarity,
        type: resultItem.type,
        assetPath: resultItem.assetPath,
        artistKey: resultItem.artistKey,
      });
    } else {
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      carousel.push(randomItem);
    }
  }

  return carousel;
}

// ============================================================
// RECYCLE DUPLICATE
// ============================================================

export async function recycleDuplicate(openingId: string, choice: "XP" | "EMBER") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = recycleDuplicateSchema.safeParse({ openingId, choice });
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const opening = await prisma.lootboxOpening.findUnique({
    where: { id: openingId },
    include: {
      lootbox: true,
    },
  });

  if (!opening) return { error: "Opening niet gevonden" };
  if (opening.userId !== session.user.id) return { error: "Geen toegang" };
  if (!opening.wasDuplicate) return { error: "Dit was geen duplicate" };
  if (opening.recycledForXP != null || opening.recycledForEmber != null) {
    return { error: "Al ingewisseld" };
  }

  const resultItem = await prisma.cosmeticItem.findUnique({
    where: { id: opening.resultItemId },
  });

  if (!resultItem) return { error: "Item niet gevonden" };

  if (choice === "XP") {
    await prisma.$transaction([
      prisma.lootboxOpening.update({
        where: { id: openingId },
        data: { recycledForXP: EMBER_CONFIG.recycleXP },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { bonusXP: { increment: EMBER_CONFIG.recycleXP } },
      }),
    ]);

    return { success: true, xpAwarded: EMBER_CONFIG.recycleXP };
  } else {
    const rarity = getRarity(resultItem.rarity);
    const emberRefund = Math.floor(opening.lootbox.emberCost * rarity.recycleRate);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emberBalance: true },
    });

    const balanceBefore = user?.emberBalance ?? 0;
    const balanceAfter = balanceBefore + emberRefund;

    await prisma.$transaction([
      prisma.lootboxOpening.update({
        where: { id: openingId },
        data: { recycledForEmber: emberRefund },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { emberBalance: balanceAfter },
      }),
      prisma.emberTransaction.create({
        data: {
          userId: session.user.id!,
          amount: emberRefund,
          type: "DUPLICATE_REFUND",
          description: `Duplicate ${resultItem.name} ingewisseld`,
          balanceBefore,
          balanceAfter,
        },
      }),
    ]);

    return { success: true, emberRefund };
  }
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

  // Check if it's a level banner (special handling — unlocked via XP, not owned)
  const levelBanner = SELLER_LEVELS.find((l) => l.nameKey === itemKey);
  if (levelBanner && slot === "banner") {
    // Validate XP unlock (reuse existing logic pattern)
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

  // Check ownership for cosmetic items
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

  // Map slot to user field
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
// BROWSE BUNDLES & LOOTBOXES
// ============================================================

export async function getActiveBundles() {
  return prisma.cosmeticBundle.findMany({
    where: { isActive: true },
    include: {
      lootboxes: {
        where: { isActive: true },
        orderBy: { emberCost: "asc" },
      },
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getLootboxDetails(lootboxId: string) {
  return prisma.lootbox.findUnique({
    where: { id: lootboxId, isActive: true },
    include: {
      bundle: true,
      items: {
        include: {
          item: {
            select: {
              id: true,
              key: true,
              type: true,
              name: true,
              rarity: true,
              assetPath: true,
            },
          },
        },
      },
    },
  });
}
