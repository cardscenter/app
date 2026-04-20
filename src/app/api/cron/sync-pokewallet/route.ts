import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSetByPokewalletId } from "@/lib/pokewallet/sync";

// GET /api/cron/sync-pokewallet
//
// Refreshes pricing for all CardSets that have a pokewalletSetId mapping.
// Runs daily — uses ~600 API calls per full pass (well within 50k/day budget).
//
// Strategy:
//   - Process all mapped sets sequentially (parallel would risk rate-limiting)
//   - Each set ~4 calls via /search?q=<set_id>&limit=100 (or N+1 via fallback for new sets)
//   - Updates CardMarket + TCGPlayer pricing per variant (normal + holo + reverse)
//   - Snapshots CardPriceHistory for trend charts

const PER_SET_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sets = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null }, cards: { some: {} } },
    select: { id: true, name: true },
  });

  let totalUpdated = 0;
  let totalUnmatched = 0;
  let totalSetsOk = 0;
  const failures: { setName: string; error: string }[] = [];

  for (const set of sets) {
    try {
      const result = await syncSetByPokewalletId(set.id);
      totalUpdated += result.updated;
      totalUnmatched += result.unmatched;
      totalSetsOk++;
    } catch (e) {
      failures.push({ setName: set.name, error: (e as Error).message.slice(0, 200) });
    }
    await sleep(PER_SET_DELAY_MS);
  }

  return NextResponse.json({
    success: true,
    totalSets: sets.length,
    setsOk: totalSetsOk,
    totalUpdated,
    totalUnmatched,
    failureCount: failures.length,
    failures: failures.slice(0, 10),
    timestamp: new Date().toISOString(),
  });
}
