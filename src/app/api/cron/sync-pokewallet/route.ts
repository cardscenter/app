import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSetByPokewalletId } from "@/lib/pokewallet/sync";
import { syncSetCatalog } from "@/lib/pokewallet/set-mapping";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/sync-pokewallet
//
// 1. Set-catalogus syncen: PokeWallet /sets ophalen, bestaande DB-sets
//    aan PW set_ids koppelen, en NIEUWE CardSet-rijen aanmaken voor
//    PW-sets die nog niemand heeft (onder een "Onbekend"-Series).
// 2. Voor elke gemapte set met cards: prijs-sync via /search.
//
// Daily run — ~600 API calls voor stap 2 (binnen pro-tier 5k/uur).
// Nieuwe sets uit stap 1 hebben nog geen cards en worden in stap 2
// overgeslagen — admin vult ze handmatig of via toekomstige
// enrichment-stap.

const PER_SET_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Sync via cron-jobs registry (admin "Run nu") wacht synchroon en is
  // bedoeld voor interactief gebruik. Deze HTTP-route is voor externe
  // schedulers en wordt na 5 min door Railway's upstream proxy gekapt —
  // dus fire-and-forget: kick het werk in achtergrond en return direct
  // 200. Resultaten + status zijn alsnog zichtbaar in /dashboard/admin/crons
  // (CronRun-tabel) zodra het werk klaar is.
  const work = withCronLogging("sync-pokewallet", async (run) => {
    // Stap 1 — Set-catalogus syncen (mapping + nieuwe sets ontdekken)
    let catalog: Awaited<ReturnType<typeof syncSetCatalog>> | null = null;
    let catalogError: string | null = null;
    try {
      catalog = await syncSetCatalog();
    } catch (e) {
      catalogError = (e as Error).message.slice(0, 200);
    }

    // Stap 2 — Prijs-sync per set
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
        const r = await syncSetByPokewalletId(set.id);
        totalUpdated += r.updated;
        totalUnmatched += r.unmatched;
        totalSetsOk++;
      } catch (e) {
        failures.push({ setName: set.name, error: (e as Error).message.slice(0, 200) });
      }
      await sleep(PER_SET_DELAY_MS);
    }

    run.setItemsProcessed(totalUpdated);
    return {
      catalog: catalog
        ? {
            mapped: catalog.matched,
            mappedTotal: catalog.total,
            duplicates: catalog.duplicates.length,
            unmatched: catalog.unmatched.length,
            createdCount: catalog.created.length,
            createdSets: catalog.created.slice(0, 20).map((s) => ({ name: s.name, pokewalletSetId: s.pokewalletSetId })),
            needsReviewCount: catalog.needsReview.length,
            needsReview: catalog.needsReview.slice(0, 20),
          }
        : { error: catalogError },
      totalSets: sets.length,
      setsOk: totalSetsOk,
      totalUpdated,
      totalUnmatched,
      failureCount: failures.length,
      failures: failures.slice(0, 10),
    };
  }, trigger);

  // Niet awaiten — laat het werk doorgaan in achtergrond, log errors
  // mocht de scheduler ze ergens willen oppikken via Railway-logs.
  void work.catch((err) => {
    console.error("[cron/sync-pokewallet] background job faalde:", err);
  });

  return NextResponse.json({
    success: true,
    status: "queued",
    note: "Werk loopt in achtergrond. Status zichtbaar via /dashboard/admin/crons.",
    timestamp: new Date().toISOString(),
  });
}
