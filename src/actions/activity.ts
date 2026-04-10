"use server";

import { prisma } from "@/lib/prisma";
import { checkActivityReward, hashIP } from "@/lib/activity-guard";
import type { ActivityAction } from "@/lib/cosmetic-config";

/**
 * Log a user activity and award Ember if eligible.
 * Called from other server actions after a genuine action succeeds.
 */
export async function logActivity(
  userId: string,
  action: ActivityAction,
  metadata?: Record<string, unknown>,
  ip?: string
) {
  const embersToAward = await checkActivityReward(userId, action);

  await prisma.activityLog.create({
    data: {
      userId,
      action,
      metadata: metadata ? JSON.stringify(metadata) : null,
      embersAwarded: embersToAward,
      ipHash: ip ? hashIP(ip) : null,
    },
  });

  if (embersToAward > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emberBalance: true },
    });

    const balanceBefore = user?.emberBalance ?? 0;
    const balanceAfter = balanceBefore + embersToAward;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { emberBalance: balanceAfter },
      }),
      prisma.emberTransaction.create({
        data: {
          userId,
          amount: embersToAward,
          type: "ACTIVITY_REWARD",
          description: action,
          balanceBefore,
          balanceAfter,
        },
      }),
    ]);
  }

  return embersToAward;
}
