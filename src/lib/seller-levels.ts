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
  { name: "Tin", nameKey: "tin", minXP: 0, color: "text-gray-500 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800", borderColor: "border-gray-300 dark:border-gray-600", icon: "🪨" },
  { name: "Copper", nameKey: "copper", minXP: 50, color: "text-orange-700 dark:text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950/30", borderColor: "border-orange-300 dark:border-orange-700", icon: "🟤" },
  { name: "Bronze", nameKey: "bronze", minXP: 150, color: "text-amber-700 dark:text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-300 dark:border-amber-700", icon: "🥉" },
  { name: "Silver", nameKey: "silver", minXP: 350, color: "text-slate-500 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800/50", borderColor: "border-slate-400 dark:border-slate-600", icon: "🥈" },
  { name: "Gold", nameKey: "gold", minXP: 700, color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-950/30", borderColor: "border-yellow-400 dark:border-yellow-600", icon: "🥇" },
  { name: "Platinum", nameKey: "platinum", minXP: 1200, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-400 dark:border-cyan-600", icon: "💠" },
  { name: "Titanium", nameKey: "titanium", minXP: 2000, color: "text-zinc-600 dark:text-zinc-300", bgColor: "bg-zinc-100 dark:bg-zinc-800/50", borderColor: "border-zinc-400 dark:border-zinc-600", icon: "⚙️" },
  { name: "Cobalt", nameKey: "cobalt", minXP: 3000, color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-400 dark:border-blue-600", icon: "🔵" },
  { name: "Jade", nameKey: "jade", minXP: 4500, color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-400 dark:border-emerald-600", icon: "🟢" },
  { name: "Amethyst", nameKey: "amethyst", minXP: 6500, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30", borderColor: "border-purple-400 dark:border-purple-600", icon: "🟣" },
  { name: "Sapphire", nameKey: "sapphire", minXP: 9000, color: "text-blue-600 dark:text-blue-300", bgColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-300 dark:border-blue-500", icon: "💎" },
  { name: "Ruby", nameKey: "ruby", minXP: 12000, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30", borderColor: "border-red-400 dark:border-red-600", icon: "🔴" },
  { name: "Emerald", nameKey: "emerald", minXP: 16000, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/30", borderColor: "border-green-400 dark:border-green-600", icon: "🟩" },
  { name: "Diamond", nameKey: "diamond", minXP: 21000, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950/30", borderColor: "border-violet-400 dark:border-violet-600", icon: "💎" },
  { name: "Obsidian", nameKey: "obsidian", minXP: 28000, color: "text-gray-800 dark:text-gray-200", bgColor: "bg-gray-900/10 dark:bg-gray-100/10", borderColor: "border-gray-700 dark:border-gray-300", icon: "🖤" },
  { name: "Champion", nameKey: "champion", minXP: 37000, color: "text-amber-600 dark:text-amber-300", bgColor: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-500 dark:border-amber-400", icon: "🏆" },
  { name: "Elite", nameKey: "elite", minXP: 48000, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950/30", borderColor: "border-rose-400 dark:border-rose-600", icon: "⭐" },
  { name: "Legend", nameKey: "legend", minXP: 62000, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30", borderColor: "border-orange-400 dark:border-orange-600", icon: "🔥" },
  { name: "Mythic", nameKey: "mythic", minXP: 78000, color: "text-fuchsia-600 dark:text-fuchsia-400", bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950/30", borderColor: "border-fuchsia-400 dark:border-fuchsia-600", icon: "✨" },
  { name: "Transcendent", nameKey: "transcendent", minXP: 95000, color: "text-yellow-500 dark:text-yellow-300", bgColor: "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30", borderColor: "border-yellow-500 dark:border-yellow-400", icon: "👑" },
];

export type XPBreakdown = {
  accountAge: number;
  sales: number;
  purchases: number;
  positiveReviews: number;
  total: number;
};

// XP rewards (revenue-based)
const XP_PER_DAY = 1;              // 1 XP per day account exists
const XP_PER_EUR_SOLD = 1;         // 1 XP per € sold
const XP_PER_EUR_BOUGHT = 1;       // 1 XP per € bought
const XP_PER_5STAR_REVIEW = 20;    // 20 XP per 5-star review

export function calculateXP(stats: {
  accountCreatedAt: Date;
  totalSalesRevenue: number;
  totalPurchasesRevenue: number;
  fiveStarReviewCount: number;
}): XPBreakdown {
  const now = new Date();
  const ageInDays = Math.floor(
    (now.getTime() - stats.accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const accountAge = ageInDays * XP_PER_DAY;
  const sales = Math.floor(stats.totalSalesRevenue * XP_PER_EUR_SOLD);
  const purchases = Math.floor(stats.totalPurchasesRevenue * XP_PER_EUR_BOUGHT);
  const positiveReviews = stats.fiveStarReviewCount * XP_PER_5STAR_REVIEW;

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
