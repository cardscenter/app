// Cosmetic system configuration — Ember currency, rarities, lootbox pricing

// ============================================================
// RARITY SYSTEM
// ============================================================

export const RARITIES = {
  UNCOMMON: {
    key: "UNCOMMON",
    label: "Uncommon",
    color: "#22c55e",
    textColor: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/60",
    glowColor: "shadow-green-500/50",
    glowClass: "glow-uncommon",
    gradientFrom: "from-green-500/20",
    recycleRate: 0.10,
  },
  RARE: {
    key: "RARE",
    label: "Rare",
    color: "#3b82f6",
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/60",
    glowColor: "shadow-blue-500/50",
    glowClass: "glow-rare",
    gradientFrom: "from-blue-500/20",
    recycleRate: 0.15,
  },
  EPIC: {
    key: "EPIC",
    label: "Epic",
    color: "#a855f7",
    textColor: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/60",
    glowColor: "shadow-purple-500/50",
    glowClass: "glow-epic",
    gradientFrom: "from-purple-500/20",
    recycleRate: 0.20,
  },
  LEGENDARY: {
    key: "LEGENDARY",
    label: "Legendary",
    color: "#eab308",
    textColor: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/60",
    glowColor: "shadow-yellow-500/50",
    glowClass: "glow-legendary",
    gradientFrom: "from-yellow-500/20",
    recycleRate: 0.30,
  },
  UNIQUE: {
    key: "UNIQUE",
    label: "Unique",
    color: "#ef4444",
    textColor: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/60",
    glowColor: "shadow-red-500/50",
    glowClass: "glow-unique",
    gradientFrom: "from-red-500/20",
    recycleRate: 0.40,
  },
  SHINY: {
    key: "SHINY",
    label: "Shiny",
    color: "#f0c040",
    textColor: "shiny-text",
    bgColor: "bg-gradient-to-br from-red-500/10 via-blue-500/10 to-purple-500/10",
    borderColor: "border-red-500/70",
    glowColor: "shadow-red-500/60",
    glowClass: "glow-shiny",
    gradientFrom: "from-red-400/30",
    recycleRate: 0.50,
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
  COMPLETE_PURCHASE: { ember: 15, maxPerDay: 5 },
  COMPLETE_SALE:     { ember: 15, maxPerDay: 5 },
  GIVE_REVIEW:       { ember: 10, maxPerDay: 3 },
  RECEIVE_REVIEW:    { ember: 5,  maxPerDay: 10 },
  PLACE_BID:         { ember: 3,  maxPerDay: 10 },
  CREATE_LISTING:    { ember: 5,  maxPerDay: 5 },
  DAILY_LOGIN:       { ember: 0,  maxPerDay: 0 },  // Handled by login streak system
} as const;

export type ActivityAction = keyof typeof ACTIVITY_REWARDS;

// Daily Ember cap per account tier (excludes login streak bonus)
export const MAX_DAILY_EMBER_BY_TIER: Record<string, number> = {
  FREE: 75,
  PRO: 150,
  UNLIMITED: Infinity,
  ADMIN: Infinity,
};

// ============================================================
// LOGIN STREAK (28-day cycle with milestone days)
// Milestones: Day 7 (100), Day 14 (200), Day 21 (300), Day 28 (500)
// After day 28: 100/day forever. Missing a day resets to day 1.
// ============================================================

export const LOGIN_STREAK_REWARDS = [
  // Week 1
  10, 15, 20, 25, 30, 40, 100,
  // Week 2
  50, 55, 60, 65, 70, 80, 200,
  // Week 3
  60, 65, 70, 75, 80, 90, 300,
  // Week 4
  70, 75, 80, 85, 90, 100, 500,
] as const;

export const LOGIN_STREAK_DAYS = LOGIN_STREAK_REWARDS.length; // 28
export const LOGIN_STREAK_POST_MAX = 100; // After day 28

export const LOGIN_STREAK_MILESTONES = new Set([7, 14, 21, 28]);

export function getLoginStreakReward(streak: number): number {
  if (streak <= 0) return LOGIN_STREAK_REWARDS[0];
  if (streak > LOGIN_STREAK_DAYS) return LOGIN_STREAK_POST_MAX;
  return LOGIN_STREAK_REWARDS[streak - 1];
}

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
