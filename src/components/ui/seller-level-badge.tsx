"use client";

import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";

interface SellerLevelBadgeProps {
  xp: number;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg";
  isPro?: boolean;
}

export function SellerLevelBadge({ xp, showProgress = false, size = "md", isPro = false }: SellerLevelBadgeProps) {
  const level = getLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${textSizes[size]} ${level.color} ${level.bgColor} ${level.borderColor}`}
      >
        <span>{level.icon}</span>
        <span>{level.name}</span>
      </span>

      {isPro && (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:border-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
          PRO
        </span>
      )}

      {showProgress && nextLevel && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {xp} / {nextLevel.minXP} XP
          </span>
        </div>
      )}
    </div>
  );
}
