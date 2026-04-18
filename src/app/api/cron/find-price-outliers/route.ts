import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichCard } from "@/lib/tcgdex/enrich-card";

// GET /api/cron/find-price-outliers
//
// Scans all cards for suspicious pricing (avg > 2× avg30 or avg > 10× low)
// and re-enriches them to apply the latest spike-smoothing logic.

const SPIKE_RATIO_AVG30 = 2;
const SPIKE_RATIO_LOW = 10;
const REQUEST_DELAY_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "scan"; // "scan" or "fix"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 1000);

  // Raw SQL is easier than Prisma for this kind of computed filter
  const outliers = await prisma.$queryRaw<Array<{ id: string; name: string; priceAvg: number; priceAvg30: number | null; priceLow: number | null }>>`
    SELECT id, name, priceAvg, priceAvg30, priceLow
    FROM Card
    WHERE priceAvg IS NOT NULL AND priceAvg > 0
      AND (
        (priceAvg30 IS NOT NULL AND priceAvg30 > 0 AND priceAvg > priceAvg30 * ${SPIKE_RATIO_AVG30})
        OR (priceLow IS NOT NULL AND priceLow > 0 AND priceAvg > priceLow * ${SPIKE_RATIO_LOW})
      )
    ORDER BY priceAvg DESC
    LIMIT ${limit}
  `;

  if (mode === "scan") {
    return NextResponse.json({
      found: outliers.length,
      samples: outliers.slice(0, 20),
    });
  }

  // mode=fix: re-enrich each outlier to apply the new spike-smoothing logic
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const card of outliers) {
    try {
      const before = card.priceAvg;
      const result = await enrichCard(card.id, { maxAgeHours: 0 });
      if (result && result.priceAvg !== before) {
        updated++;
        console.log(`[outlier-fix] ${card.id} (${card.name}): €${before} → €${result.priceAvg}`);
      } else {
        unchanged++;
      }
      await sleep(REQUEST_DELAY_MS);
    } catch (e) {
      failed++;
      console.error(`[outlier-fix] ${card.id} failed:`, e);
    }
  }

  return NextResponse.json({
    scanned: outliers.length,
    updated,
    unchanged,
    failed,
  });
}
