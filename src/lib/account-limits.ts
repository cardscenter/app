import { prisma } from "@/lib/prisma";
import { getTierConfig } from "@/lib/subscription-tiers";

export async function checkAuctionLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const tier = getTierConfig(user.accountType);
  const activeCount = await prisma.auction.count({
    where: { sellerId: userId, status: "ACTIVE" },
  });

  return {
    allowed: activeCount < tier.limits.maxActiveAuctions,
    current: activeCount,
    max: tier.limits.maxActiveAuctions,
  };
}

export async function checkClaimsaleLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const tier = getTierConfig(user.accountType);
  const activeCount = await prisma.claimsale.count({
    where: { sellerId: userId, status: "LIVE" },
  });

  return {
    allowed: activeCount < tier.limits.maxActiveClaimsales,
    current: activeCount,
    max: tier.limits.maxActiveClaimsales,
    maxItems: tier.limits.maxItemsPerClaimsale,
  };
}

export async function checkListingLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const tier = getTierConfig(user.accountType);
  const activeCount = await prisma.listing.count({
    where: { sellerId: userId, status: "ACTIVE" },
  });

  return {
    allowed: activeCount < tier.limits.maxActiveListings,
    current: activeCount,
    max: tier.limits.maxActiveListings,
  };
}
