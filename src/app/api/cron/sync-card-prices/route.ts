import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichCard } from "@/lib/tcgdex/enrich-card";

// GET /api/cron/sync-card-prices
//
// Refreshes the cached Cardmarket pricing snapshot for the most relevant
// cards. Strategy:
//   1) cards currently linked to an active marketplace item (high priority)
//   2) cards recently viewed in the public card-database
//
// Cards with `priceUpdatedAt` younger than `MIN_AGE_HOURS` are skipped to
// avoid hammering TCGdex within their nightly scrape window.
//
// Defaults are conservative: ~50 cards/run × 200ms sleep ≈ 10s total. Run
// hourly via Vercel Cron (or whatever scheduler) — over 24h this naturally
// covers the warm tail of the catalog.

const MIN_AGE_HOURS = 12;
const REQUEST_DELAY_MS = 200;
const DEFAULT_LIMIT = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 200);

  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);

  // 1) Cards in active marketplace items (highest priority)
  const activeIds = new Set<string>();
  const [activeListings, activeAuctions, activeClaims] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "ACTIVE", tcgdexId: { not: null } },
      select: { tcgdexId: true },
      take: limit,
    }),
    prisma.auction.findMany({
      where: { status: "ACTIVE", tcgdexId: { not: null } },
      select: { tcgdexId: true },
      take: limit,
    }),
    prisma.claimsaleItem.findMany({
      where: { status: "AVAILABLE", tcgdexId: { not: null }, claimsale: { status: "LIVE" } },
      select: { tcgdexId: true },
      take: limit,
    }),
  ]);
  for (const r of activeListings) if (r.tcgdexId) activeIds.add(r.tcgdexId);
  for (const r of activeAuctions) if (r.tcgdexId) activeIds.add(r.tcgdexId);
  for (const r of activeClaims) if (r.tcgdexId) activeIds.add(r.tcgdexId);

  // 2) Recently viewed cards (sorted by lastViewedAt desc) to fill the rest
  const remaining = Math.max(0, limit - activeIds.size);
  const recentlyViewed =
    remaining > 0
      ? await prisma.card.findMany({
          where: {
            id: { notIn: Array.from(activeIds) },
            lastViewedAt: { not: null },
            OR: [{ priceUpdatedAt: null }, { priceUpdatedAt: { lt: cutoff } }],
          },
          orderBy: { lastViewedAt: "desc" },
          select: { id: true },
          take: remaining,
        })
      : [];

  const targetIds = [...activeIds, ...recentlyViewed.map((c) => c.id)];

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of targetIds) {
    try {
      // Re-check freshness — active items might have been refreshed since last
      const card = await prisma.card.findUnique({
        where: { id },
        select: { priceUpdatedAt: true },
      });
      if (card?.priceUpdatedAt && card.priceUpdatedAt > cutoff) {
        skipped++;
        continue;
      }
      await enrichCard(id, { maxAgeHours: 0 });
      updated++;
      await sleep(REQUEST_DELAY_MS);
    } catch (e) {
      failed++;
      console.error(`sync-card-prices: ${id} failed:`, e);
    }
  }

  return NextResponse.json({
    success: true,
    targetCount: targetIds.length,
    updated,
    skipped,
    failed,
    timestamp: new Date().toISOString(),
  });
}
