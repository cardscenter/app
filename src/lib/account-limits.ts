import { prisma } from "@/lib/prisma";
import { getTierConfig } from "@/lib/subscription-tiers";

export async function checkAuctionLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const tier = getTierConfig(user.accountType);
  // SCHEDULED telt mee in de cap — anders kan een seller cap omzeilen door
  // 10 SCHEDULED + N ACTIVE te hebben.
  const activeCount = await prisma.auction.count({
    where: { sellerId: userId, status: { in: ["ACTIVE", "SCHEDULED"] } },
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
  // SCHEDULED telt mee in de cap — anders kan een seller de cap omzeilen door
  // claimsales vooruit te plannen.
  const activeCount = await prisma.claimsale.count({
    where: { sellerId: userId, status: { in: ["LIVE", "SCHEDULED"] } },
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
  // PARTIALLY_SOLD telt mee — anders kan een seller via partial-sales onbeperkt
  // nieuwe listings publiceren door telkens de eerste deels te verkopen.
  const activeCount = await prisma.listing.count({
    where: { sellerId: userId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
  });

  return {
    allowed: activeCount < tier.limits.maxActiveListings,
    current: activeCount,
    max: tier.limits.maxActiveListings,
  };
}
