// Cosmetic system configuration — Ember currency, rarities, lootbox pricing

// ============================================================
// RARITY SYSTEM
// ============================================================

export const RARITIES = {
  UNCOMMON: {
    key: "UNCOMMON",
    label: "Uncommon",
    color: "#22c55e",           // green-500
    textColor: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500",
    glowColor: "shadow-green-500/50",
    recycleRate: 0.10,          // 10% of lootbox cost back
  },
  RARE: {
    key: "RARE",
    label: "Rare",
    color: "#3b82f6",           // blue-500
    textColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
    glowColor: "shadow-blue-500/50",
    recycleRate: 0.15,
  },
  EPIC: {
    key: "EPIC",
    label: "Epic",
    color: "#a855f7",           // purple-500
    textColor: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500",
    glowColor: "shadow-purple-500/50",
    recycleRate: 0.20,
  },
  LEGENDARY: {
    key: "LEGENDARY",
    label: "Legendary",
    color: "#eab308",           // yellow-500
    textColor: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500",
    glowColor: "shadow-yellow-500/50",
    recycleRate: 0.30,
  },
  UNIQUE: {
    key: "UNIQUE",
    label: "Unique",
    color: "#ef4444",           // red-500
    textColor: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500",
    glowColor: "shadow-red-500/50",
    recycleRate: 0.40,
  },
} as const;

export type RarityKey = keyof typeof RARITIES;

export function getRarity(key: string) {
  return RARITIES[key as RarityKey] ?? RARITIES.UNCOMMON;
}

// ============================================================
// EMBER PRICING
// ============================================================

export const EMBER_CONFIG = {
  // Wallet → Ember conversion
  eurToEmber: 100,              // 1 EUR = 100 Ember
  minPurchase: 100,             // Minimum 100 Ember (€1)
  maxPurchasePerDay: 5000,      // Maximum 5000 Ember (€50) per day

  // Lootbox pricing
  standardPackCost: 150,        // 150 Ember
  premiumPackCost: 400,         // 400 Ember

  // Duplicate recycling
  recycleXP: 5,                 // Flat 5 XP for any duplicate
} as const;

// ============================================================
// ACTIVITY REWARDS
// ============================================================

export const ACTIVITY_REWARDS = {
  COMPLETE_PURCHASE: { ember: 10, maxPerDay: 5 },
  COMPLETE_SALE:     { ember: 10, maxPerDay: 5 },
  GIVE_REVIEW:       { ember: 5,  maxPerDay: 3 },
  RECEIVE_REVIEW:    { ember: 3,  maxPerDay: 10 },
  PLACE_BID:         { ember: 2,  maxPerDay: 10 },
  CREATE_LISTING:    { ember: 2,  maxPerDay: 5 },
  DAILY_LOGIN:       { ember: 5,  maxPerDay: 1 },
} as const;

export type ActivityAction = keyof typeof ACTIVITY_REWARDS;

// Daily Ember cap per account tier
export const MAX_DAILY_EMBER_BY_TIER: Record<string, number> = {
  FREE: 50,
  PRO: 100,
  UNLIMITED: Infinity,
  ADMIN: Infinity,
};

// ============================================================
// COSMETIC ITEM TYPES
// ============================================================

export const COSMETIC_TYPES = {
  BANNER: "BANNER",
  EMBLEM: "EMBLEM",
  BACKGROUND: "BACKGROUND",
  XP_REWARD: "XP_REWARD",
  EMBER_REWARD: "EMBER_REWARD",
} as const;

export type CosmeticType = (typeof COSMETIC_TYPES)[keyof typeof COSMETIC_TYPES];
