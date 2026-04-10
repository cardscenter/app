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
  { name: "Beginner", nameKey: "beginner", minXP: 0, color: "text-gray-500 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800", borderColor: "border-gray-300 dark:border-gray-600", icon: "🎒" },
  { name: "Rookie", nameKey: "rookie", minXP: 100, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950", borderColor: "border-green-300 dark:border-green-700", icon: "⚡" },
  { name: "Scout", nameKey: "scout", minXP: 300, color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-50 dark:bg-teal-950", borderColor: "border-teal-300 dark:border-teal-700", icon: "🔍" },
  { name: "Trainer", nameKey: "trainer", minXP: 750, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950", borderColor: "border-blue-300 dark:border-blue-700", icon: "🎯" },
  { name: "Challenger", nameKey: "challenger", minXP: 1500, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950", borderColor: "border-orange-300 dark:border-orange-700", icon: "🔥" },
  { name: "Rival", nameKey: "rival", minXP: 3000, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950", borderColor: "border-red-300 dark:border-red-700", icon: "⚔️" },
  { name: "Veteran", nameKey: "veteran", minXP: 5000, color: "text-stone-600 dark:text-stone-400", bgColor: "bg-stone-50 dark:bg-stone-950", borderColor: "border-stone-400 dark:border-stone-600", icon: "🛡️" },
  { name: "Gym Leader", nameKey: "gymLeader", minXP: 8000, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950", borderColor: "border-purple-300 dark:border-purple-700", icon: "🏅" },
  { name: "Elite", nameKey: "elite", minXP: 12000, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950", borderColor: "border-cyan-300 dark:border-cyan-700", icon: "💫" },
  { name: "Expert", nameKey: "expert", minXP: 17000, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-950", borderColor: "border-indigo-300 dark:border-indigo-700", icon: "🌟" },
  { name: "Master", nameKey: "master", minXP: 23000, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-amber-400 dark:border-amber-600", icon: "👑" },
  { name: "Grandmaster", nameKey: "grandmaster", minXP: 32000, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950", borderColor: "border-rose-400 dark:border-rose-600", icon: "💎" },
  { name: "Legend", nameKey: "legend", minXP: 50000, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950", borderColor: "border-violet-400 dark:border-violet-600", icon: "🔱" },
  { name: "Champion", nameKey: "champion", minXP: 100000, color: "text-yellow-500 dark:text-yellow-300", bgColor: "bg-yellow-50 dark:bg-yellow-950", borderColor: "border-yellow-500 dark:border-yellow-400", icon: "🏆" },
];

export type XPBreakdown = {
  accountAge: number;
  sales: number;
  purchases: number;
  positiveReviews: number;
  reviewsGiven: number;
  completedTransactions: number;
  bonus: number;
  total: number;
};

// XP rewards
const XP_PER_DAY = 1;                    // 1 XP per day account exists
const XP_PER_EUR_SOLD = 1;               // 1 XP per € sold
const XP_PER_EUR_BOUGHT = 1;             // 1 XP per € bought
const XP_PER_5STAR_REVIEW = 20;          // 20 XP per 5-star review received
const XP_PER_REVIEW_GIVEN = 5;           // 5 XP per review given
const XP_PER_COMPLETED_TRANSACTION = 10; // 10 XP per completed shipping bundle

export function calculateXP(stats: {
  accountCreatedAt: Date;
  totalSalesRevenue: number;
  totalPurchasesRevenue: number;
  fiveStarReviewCount: number;
  reviewsGivenCount: number;
  completedTransactionCount: number;
  bonusXP?: number;
}): XPBreakdown {
  const now = new Date();
  const ageInDays = Math.floor(
    (now.getTime() - stats.accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const accountAge = ageInDays * XP_PER_DAY;
  const sales = Math.floor(stats.totalSalesRevenue * XP_PER_EUR_SOLD);
  const purchases = Math.floor(stats.totalPurchasesRevenue * XP_PER_EUR_BOUGHT);
  const positiveReviews = stats.fiveStarReviewCount * XP_PER_5STAR_REVIEW;
  const reviewsGiven = stats.reviewsGivenCount * XP_PER_REVIEW_GIVEN;
  const completedTransactions = stats.completedTransactionCount * XP_PER_COMPLETED_TRANSACTION;
  const bonus = stats.bonusXP ?? 0;

  return {
    accountAge,
    sales,
    purchases,
    positiveReviews,
    reviewsGiven,
    completedTransactions,
    bonus,
    total: accountAge + sales + purchases + positiveReviews + reviewsGiven + completedTransactions + bonus,
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

export function getBannerUrl(nameKey: string): string {
  // Convert camelCase nameKey to kebab-case for file lookup
  const kebab = nameKey.replace(/([A-Z])/g, "-$1").toLowerCase();
  return `/images/tier-banners/${kebab}-banner.jpg`;
}

export function getLevelProgress(xp: number): number {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return 100;

  const range = next.minXP - current.minXP;
  const progress = xp - current.minXP;
  return Math.min(100, Math.round((progress / range) * 100));
}
