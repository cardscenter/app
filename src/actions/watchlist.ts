"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type WatchlistTarget =
  | { auctionId: string }
  | { claimsaleId: string }
  | { listingId: string };

export async function toggleWatchlist(target: WatchlistTarget) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const where = {
    ...("auctionId" in target
      ? { userId_auctionId: { userId: session.user.id, auctionId: target.auctionId } }
      : "claimsaleId" in target
        ? { userId_claimsaleId: { userId: session.user.id, claimsaleId: target.claimsaleId } }
        : { userId_listingId: { userId: session.user.id, listingId: target.listingId } }),
  };

  const existing = await prisma.watchlist.findUnique({ where });

  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    return { watched: false };
  }

  await prisma.watchlist.create({
    data: {
      userId: session.user.id,
      ...target,
    },
  });

  return { watched: true };
}

export async function isWatched(target: WatchlistTarget): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const where = {
    ...("auctionId" in target
      ? { userId_auctionId: { userId: session.user.id, auctionId: target.auctionId } }
      : "claimsaleId" in target
        ? { userId_claimsaleId: { userId: session.user.id, claimsaleId: target.claimsaleId } }
        : { userId_listingId: { userId: session.user.id, listingId: target.listingId } }),
  };

  const item = await prisma.watchlist.findUnique({ where });
  return !!item;
}
