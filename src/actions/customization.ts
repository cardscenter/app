"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMBER_CONFIG, getRarity } from "@/lib/cosmetic-config";
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

export async function purchaseEmber(amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = purchaseEmberSchema.safeParse({ amount });
  if (!parsed.success) return { error: "Ongeldig bedrag" };

  const eurCost = amount / EMBER_CONFIG.eurToEmber;

  // Check daily purchase limit
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const purchasedToday = await prisma.emberTransaction.aggregate({
    where: {
      userId: session.user.id,
      type: "WALLET_PURCHASE",
      amount: { gt: 0 },
      createdAt: { gte: startOfDay },
    },
    _sum: { amount: true },
  });

  const alreadyPurchased = purchasedToday._sum.amount ?? 0;
  if (alreadyPurchased + amount > EMBER_CONFIG.maxPurchasePerDay) {
    return { error: "Dagelijks aankooplimiet bereikt" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, reservedBalance: true, emberBalance: true },
  });

  if (!user) return { error: "Gebruiker niet gevonden" };

  const availableBalance = user.balance - user.reservedBalance;
  if (availableBalance < eurCost) return { error: "Onvoldoende saldo" };

  const balanceBefore = user.emberBalance;
  const balanceAfter = balanceBefore + amount;

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
        description: `${amount} Ember gekocht`,
      },
    }),
    prisma.emberTransaction.create({
      data: {
        userId: session.user.id,
        amount,
        type: "WALLET_PURCHASE",
        description: `${amount} Ember gekocht voor €${eurCost.toFixed(2)}`,
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

    // Add to owned items if not duplicate
    if (!wasDuplicate) {
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
    },
    wasDuplicate,
    carouselItems,
    resultIndex: Math.floor(decoyCount * 0.8), // Place result near the end
    newEmberBalance: balanceAfter,
    lootboxCost: lootbox.emberCost,
  };
}

function selectRandomItem(lootbox: {
  weightUncommon: number;
  weightRare: number;
  weightEpic: number;
  weightLegendary: number;
  weightUnique: number;
  items: Array<{ item: { id: string; key: string; type: string; name: string; rarity: string; assetPath: string | null; rewardValue: number | null; weight: number } }>;
}) {
  const items = lootbox.items.map((li) => li.item);

  // Step 1: Pick a rarity tier
  const totalWeight =
    lootbox.weightUncommon +
    lootbox.weightRare +
    lootbox.weightEpic +
    lootbox.weightLegendary +
    lootbox.weightUnique;

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
  } else {
    selectedRarity = "UNIQUE";
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
    items: Array<{ item: { id: string; key: string; name: string; rarity: string; assetPath: string | null } }>;
  },
  resultItem: { id: string; key: string; name: string; rarity: string; assetPath: string | null },
  count: number
) {
  const allItems = lootbox.items.map((li) => ({
    id: li.item.id,
    key: li.item.key,
    name: li.item.name,
    rarity: li.item.rarity,
    assetPath: li.item.assetPath,
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
        assetPath: resultItem.assetPath,
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
