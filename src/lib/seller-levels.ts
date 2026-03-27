export type SellerLevel = {
  name: string;
  nameKey: string;
  minXP: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
};

export const SELLER_LEVELS: SellerLevel[] = [
  {
    name: "Starter",
    nameKey: "starter",
    minXP: 0,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-300 dark:border-gray-600",
    icon: "🌱",
  },
  {
    name: "Bronze",
    nameKey: "bronze",
    minXP: 50,
    color: "text-amber-700 dark:text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-300 dark:border-amber-700",
    icon: "🥉",
  },
  {
    name: "Silver",
    nameKey: "silver",
    minXP: 200,
    color: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-400 dark:border-slate-600",
    icon: "🥈",
  },
  {
    name: "Gold",
    nameKey: "gold",
    minXP: 500,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-400 dark:border-yellow-600",
    icon: "🥇",
  },
  {
    name: "Platinum",
    nameKey: "platinum",
    minXP: 1000,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    borderColor: "border-cyan-400 dark:border-cyan-600",
    icon: "💎",
  },
  {
    name: "Diamond",
    nameKey: "diamond",
    minXP: 2500,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    borderColor: "border-violet-400 dark:border-violet-600",
    icon: "👑",
  },
];

export type XPBreakdown = {
  accountAge: number;
  sales: number;
  purchases: number;
  positiveReviews: number;
  total: number;
};

// XP rewards
const XP_PER_DAY = 1; // 1 XP per day account exists
const XP_PER_SALE = 10; // 10 XP per completed sale
const XP_PER_PURCHASE = 5; // 5 XP per purchase
const XP_PER_POSITIVE_REVIEW = 15; // 15 XP per positive review (4-5 stars)

export function calculateXP(stats: {
  accountCreatedAt: Date;
  totalSales: number;
  totalPurchases: number;
  positiveReviewCount: number;
}): XPBreakdown {
  const now = new Date();
  const ageInDays = Math.floor(
    (now.getTime() - stats.accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const accountAge = ageInDays * XP_PER_DAY;
  const sales = stats.totalSales * XP_PER_SALE;
  const purchases = stats.totalPurchases * XP_PER_PURCHASE;
  const positiveReviews = stats.positiveReviewCount * XP_PER_POSITIVE_REVIEW;

  return {
    accountAge,
    sales,
    purchases,
    positiveReviews,
    total: accountAge + sales + purchases + positiveReviews,
  };
}

export function getLevel(xp: number): SellerLevel {
  let level = SELLER_LEVELS[0];
  for (const l of SELLER_LEVELS) {
    if (xp >= l.minXP) level = l;
  }
  return level;
}

export function getNextLevel(xp: number): SellerLevel | null {
  for (const l of SELLER_LEVELS) {
    if (xp < l.minXP) return l;
  }
  return null;
}

export function getLevelProgress(xp: number): number {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return 100;

  const range = next.minXP - current.minXP;
  const progress = xp - current.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}
