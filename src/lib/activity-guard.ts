import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_REWARDS,
  MAX_DAILY_EMBER_BY_TIER,
  type ActivityAction,
} from "@/lib/cosmetic-config";
import crypto from "crypto";

/**
 * Check if a user can earn Ember for a specific action.
 * Returns the amount of Ember to award (0 if rate-limited).
 */
export async function checkActivityReward(
  userId: string,
  action: ActivityAction
): Promise<number> {
  const reward = ACTIVITY_REWARDS[action];
  if (!reward) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Get user's account tier for daily cap
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  });

  const dailyCap = MAX_DAILY_EMBER_BY_TIER[user?.accountType ?? "FREE"] ?? 50;

  // Check per-action daily limit
  const actionCountToday = await prisma.activityLog.count({
    where: {
      userId,
      action,
      embersAwarded: { gt: 0 },
      createdAt: { gte: startOfDay },
    },
  });

  if (actionCountToday >= reward.maxPerDay) return 0;

  // Check total daily Ember cap (Infinity for UNLIMITED/ADMIN)
  if (dailyCap !== Infinity) {
    const totalEmbersToday = await prisma.activityLog.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
      _sum: { embersAwarded: true },
    });

    const earnedToday = totalEmbersToday._sum.embersAwarded ?? 0;
    if (earnedToday >= dailyCap) return 0;

    return Math.min(reward.ember, dailyCap - earnedToday);
  }

  return reward.ember;
}

/**
 * Hash an IP address for privacy-safe storage.
 */
export function hashIP(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
