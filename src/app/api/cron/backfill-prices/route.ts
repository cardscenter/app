import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichCard } from "@/lib/tcgdex/enrich-card";

// GET /api/cron/backfill-prices
//
// Finds cards that have NEVER had pricing data and enriches them.
// This covers the ~500 cards that were imported but never viewed and
// therefore never went through the enrichment pipeline.
//
// Uses a conservative delay to avoid hammering upstream APIs.
// Run with ?limit=N to control batch size (default 50, max 500).

const REQUEST_DELAY_MS = 300;
const DEFAULT_LIMIT = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    500
  );

  // Find cards that need pricing.
  // Optional filters: ?set=smp (specific set), ?prefix=TG (localId prefix, forces re-enrich)
  const setFilter = searchParams.get("set");
  const prefixFilter = searchParams.get("prefix");

  const cards = await prisma.card.findMany({
    where: {
      // When prefix is given, re-enrich regardless of existing pricing
      ...(prefixFilter
        ? { localId: { startsWith: prefixFilter } }
        : { priceAvg: null, priceAvg7: null, priceReverseAvg: null, priceReverseAvg7: null }),
      ...(setFilter
        ? { cardSet: { tcgdexSetId: setFilter } }
        : {}),
    },
    select: { id: true, name: true },
    take: limit,
  });

  let updated = 0;
  let stillNull = 0;
  let failed = 0;

  for (const card of cards) {
    try {
      const result = await enrichCard(card.id, { maxAgeHours: 0 });
      // Check if we actually got pricing
      if (
        result &&
        (result.priceAvg !== null || result.priceReverseAvg !== null)
      ) {
        updated++;
        console.log(`backfill OK: ${card.id} (${card.name}) → avg=${result.priceAvg}`);
      } else {
        stillNull++;
        console.log(`backfill NULL: ${card.id} (${card.name}) → no pricing found`);
      }
      await sleep(REQUEST_DELAY_MS);
    } catch (e) {
      failed++;
      console.error(`backfill-prices: ${card.id} (${card.name}) failed:`, e);
    }
  }

  // Count remaining
  const remaining = await prisma.card.count({
    where: {
      priceAvg: null,
      priceAvg7: null,
      priceReverseAvg: null,
      priceReverseAvg7: null,
    },
  });

  return NextResponse.json({
    success: true,
    batch: cards.length,
    updated,
    stillNull,
    failed,
    remaining,
    timestamp: new Date().toISOString(),
  });
}
