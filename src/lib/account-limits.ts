import { prisma } from "@/lib/prisma";
import { ACCOUNT_LIMITS } from "@/types";

export async function checkAuctionLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const limits = ACCOUNT_LIMITS[user.accountType as "FREE" | "PREMIUM"];
  const activeCount = await prisma.auction.count({
    where: { sellerId: userId, status: "ACTIVE" },
  });

  return {
    allowed: activeCount < limits.maxActiveAuctions,
    current: activeCount,
    max: limits.maxActiveAuctions,
  };
}

export async function checkClaimsaleLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const limits = ACCOUNT_LIMITS[user.accountType as "FREE" | "PREMIUM"];
  const activeCount = await prisma.claimsale.count({
    where: { sellerId: userId, status: "LIVE" },
  });

  return {
    allowed: activeCount < limits.maxActiveClaimsales,
    current: activeCount,
    max: limits.maxActiveClaimsales,
    maxItems: limits.maxItemsPerClaimsale,
  };
}
