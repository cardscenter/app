import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSetByPokewalletId } from "@/lib/pokewallet/sync";
import { syncSetCatalog } from "@/lib/pokewallet/set-mapping";
import { backfillTcgdexPricing } from "@/lib/pokewallet/tcgdex-pricing";
import { withCronLogging } from "@/lib/cron-logging";
import { resolveCronTrigger } from "@/lib/cron-auth";

// GET /api/cron/sync-pokewallet[?limit=N]
//
// 1. Set-catalogus syncen: PokeWallet /sets ophalen, bestaande DB-sets
//    aan PW set_ids koppelen, en NIEUWE CardSet-rijen aanmaken voor
//    PW-sets die nog niemand heeft (onder een "Onbekend"-Series).
// 2. Voor elke gemapte STALE set met cards: prijs-sync via /search.
//    "Stale" = minstens 1 card heeft priceUpdatedAt NULL of ouder dan
//    STALE_AFTER_HOURS. Verse sets worden overgeslagen — idempotent
//    en lichtgewicht in dezelfde dag, zelf-resumend bij chunk-runs.
//
// Optionele `?limit=N` query-param verwerkt maximaal N stale sets per
// call. Handig om binnen Railway's 5-min HTTP timeout te blijven en
// in chunks naar een eerste-vulling toe te werken (8 chunks van 20
// sets dekken ~160 sets binnen ~30 min). Zonder limit: alle stale
// sets in één pass.
//
// Daily run — ~600 API calls voor stap 2 (binnen pro-tier 5k/uur).
// Nieuwe sets uit stap 1 hebben nog geen cards en worden in stap 2
// overgeslagen — admin vult ze handmatig of via toekomstige
// enrichment-stap.

const PER_SET_DELAY_MS = 100;
const STALE_AFTER_HOURS = 12;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  const trigger = await resolveCronTrigger(request);
  if (!trigger) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.floor(Number(limitParam))) : undefined;

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

    // Stap 2 — Prijs-sync per STALE set.
    // Stale = GEEN card in de set heeft priceUpdatedAt binnen de afgelopen
    // STALE_AFTER_HOURS. Zodra een set in chunk N wordt gesynced, krijgen
    // alle PW-matchende cards priceUpdatedAt = NOW, dus volgende chunks
    // slaan deze set over. PokeWallet-unmatchable cards (blijven NULL)
    // blokkeren een set NIET — anders zou de chunk-runner eindeloos op
    // dezelfde set spinnen omdat unmatchable cards niet vol te krijgen
    // zijn. Cron-route is zo zelf-resumend zonder externe bookkeeping.
    const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);
    const staleWhere = {
      pokewalletSetId: { not: null },
      cards: {
        none: { priceUpdatedAt: { gt: cutoff } },
      },
    };

    const totalStaleSets = await prisma.cardSet.count({ where: staleWhere });
    const sets = await prisma.cardSet.findMany({
      where: staleWhere,
      select: { id: true, name: true },
      orderBy: { id: "asc" },
      ...(limit ? { take: limit } : {}),
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

    // Stap 3 — TCGdex CardMarket-fallback voor kaarten die PokeWallet niet kan
    // prijzen (oude promo's, basis-energie, secret holos). Draait NA de PW-sync
    // zodat een lege PW-prijs deze waarden niet overschrijft. Match op exacte
    // kaart-id (= TCGdex-id) → variant-veilig. Alleen op de volledige dagrun
    // (niet tijdens chunked backfills) want het scant alle prijsloze kaarten.
    let tcgdexFallback: { checked: number; priced: number } | null = null;
    if (!limit) {
      try {
        const r = await backfillTcgdexPricing();
        tcgdexFallback = { checked: r.checked, priced: r.priced };
      } catch (e) {
        tcgdexFallback = { checked: -1, priced: 0 };
        console.error("[cron/sync-pokewallet] TCGdex-fallback faalde:", (e as Error).message);
      }
    }

    run.setItemsProcessed(totalUpdated + (tcgdexFallback?.priced ?? 0));
    return {
      tcgdexFallback,
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
      limit: limit ?? null,
      totalStaleSetsBefore: totalStaleSets,
      processedSets: sets.length,
      remainingStaleSets: Math.max(0, totalStaleSets - sets.length),
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
