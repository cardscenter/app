import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { KaartenSearch } from "@/components/card/kaarten-search";
import { DatabaseStats } from "@/components/card/database-stats";
import { DatabaseMarquee } from "@/components/card/database-marquee";
import { DatabaseTrending, type TrendingCard } from "@/components/card/database-trending";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";
import { getDisplayPrice, computeWeeklyDeltaPct } from "@/lib/display-price";
import { Layers, BookOpen, Banknote, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Pokémon kaarten — Cards Center",
  description:
    "Bekijk alle Pokémon kaarten per set. Vergelijk prijzen, zie wat er nu te koop is en zet kaarten op je watchlist.",
};

export const revalidate = 3600; // re-render hourly

export default async function CardsOverviewPage() {
  // Cutoff for "recente" sets — last 3 years. Older prices can be stale /
  // illiquid on CardMarket so we exclude them from marquee + trending to
  // avoid showing misleading numbers.
  const threeYearsCutoff = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 10);
  })();

  // Hero-stats queries + series list in parallel so the page renders in
  // one DB round-trip.
  const [
    series,
    cardAggregate,
    setCount,
    latestSet,
    marqueeCards,
    trendingCards,
  ] = await Promise.all([
    // Only series that actually have cards in our local DB.
    // "tcgp" = Pokémon TCG Pocket (mobile game) — different product, excluded.
    prisma.series.findMany({
      where: {
        tcgdexSeriesId: { not: null, notIn: ["tcgp"] },
        cardSets: { some: { cards: { some: {} } } },
      },
      include: {
        cardSets: {
          where: { cards: { some: {} } },
          orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            tcgdexSetId: true,
            logoUrl: true,
            releaseDate: true,
            cardCount: true,
          },
        },
      },
    }),
    // Aggregate: total card count + sum of market values
    prisma.card.aggregate({
      _count: { _all: true },
      _sum: { priceAvg: true },
    }),
    // Number of sets with at least one card
    prisma.cardSet.count({ where: { cards: { some: {} } } }),
    // Most recent set by release date
    prisma.cardSet.findFirst({
      where: { cards: { some: {} }, releaseDate: { not: null } },
      orderBy: { releaseDate: "desc" },
      select: { name: true, tcgdexSetId: true },
    }),
    // Marquee pool — top 80 priceAvg cards from sets released in the last
    // 3 years. We shuffle in JS before showing 40, so each hourly render
    // mixes things up instead of always leading with the same Charizard.
    prisma.card.findMany({
      where: {
        priceAvg: { gte: 20, lte: 3000 },
        cardSet: { releaseDate: { gte: threeYearsCutoff } },
      },
      orderBy: { priceAvg: "desc" },
      include: { cardSet: { select: { tcgdexSetId: true } } },
      take: 80,
    }),
    // Candidate pool for trending movers — same 3-year cutoff. Require
    // priceAvg and priceAvg7 both above €5 so the % delta is meaningful
    // (€0.05 → €0.10 is technically +100% but useless info). Pulling
    // priceTrend + pricePriceChartingEur for the display-price blender
    // so expensive chase cards use a smoother current price.
    prisma.card.findMany({
      where: {
        priceAvg: { gte: 5 },
        priceAvg7: { gte: 5 },
        cardSet: { releaseDate: { gte: threeYearsCutoff } },
      },
      select: {
        id: true, name: true, localId: true, rarity: true,
        priceAvg: true, priceAvg7: true, priceTrend: true,
        pricePriceChartingEur: true,
        imageUrl: true, imageUrlFull: true,
        cardSet: { select: { name: true, tcgdexSetId: true } },
      },
    }),
  ]);

  // Sort series by the max release-date across all their sets (handles nulls
  // reliably). Most-recent series first.
  // Within each series: pin the Promo set first, then the rest by release date desc.
  const isPromoSet = (name: string) => /\bpromo/i.test(name);

  const sortedSeries = series
    .map((s) => {
      const latest = s.cardSets.reduce<string>((max, set) => {
        const d = set.releaseDate ?? "";
        return d > max ? d : max;
      }, "");
      const cardSets = [...s.cardSets].sort((a, b) => {
        const ap = isPromoSet(a.name);
        const bp = isPromoSet(b.name);
        if (ap !== bp) return ap ? 1 : -1; // promos last (= oldest in the series chronology)
        const ad = a.releaseDate ?? "";
        const bd = b.releaseDate ?? "";
        return bd.localeCompare(ad); // newer first
      });
      return { ...s, cardSets, latestRelease: latest || "0000-00-00" };
    })
    .sort((a, b) => b.latestRelease.localeCompare(a.latestRelease));

  // Marquee: pick a random 40 out of the top-80 pool so each hourly render
  // mixes things up. Fisher-Yates shuffle on a copy.
  const shuffled = [...marqueeCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const marqueeItems = shuffled
    .slice(0, 40)
    .map((c) => ({
      id: c.id,
      name: c.name,
      localId: c.localId,
      setSlug: c.cardSet.tcgdexSetId ?? "",
      imageUrl: getCardImageUrl(c, "low"),
      priceAvg: c.priceAvg,
    }))
    .filter((c) => c.setSlug && c.imageUrl);

  // Trending: "current" uses getDisplayPrice() which blends CardMarket
  // avg/trend with PriceCharting for expensive cards (>=€250), so single
  // outlier sales on illiquid chase cards don't produce phantom swings.
  // Baseline stays priceAvg7 so the "deze week" label remains accurate.
  const withDelta = trendingCards
    .filter((c): c is typeof c & { priceAvg: number; priceAvg7: number; cardSet: { name: string; tcgdexSetId: string } } =>
      c.priceAvg != null &&
      c.priceAvg7 != null && c.priceAvg7 > 0 &&
      !!c.cardSet.tcgdexSetId
    )
    .map((c) => {
      const displayPrice = getDisplayPrice(c) ?? c.priceAvg;
      const deltaPct = computeWeeklyDeltaPct(c);
      return {
        id: c.id,
        name: c.name,
        localId: c.localId,
        setName: c.cardSet.name,
        setSlug: c.cardSet.tcgdexSetId,
        imageUrl: getCardImageUrl(c, "low"),
        priceAvg: displayPrice,
        priceAvg7: c.priceAvg7,
        deltaPct: deltaPct ?? 0,
      };
    })
    // Require ≥3% absolute move to clear the near-zero noise floor
    .filter((c) => Math.abs(c.deltaPct) >= 3);
  const risers: TrendingCard[] = [...withDelta].sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 10);
  const fallers: TrendingCard[] = [...withDelta].sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Kaarten" }]} />

      <header className="mb-6 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layers className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pokémon Kaarten Database</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bekijk alle kaarten per set, vergelijk marktprijzen en zie wat er nu te koop is.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <DatabaseStats
          totalCards={cardAggregate._count._all}
          totalSets={setCount}
          totalMarketValueEur={cardAggregate._sum.priceAvg ?? 0}
          latestSetName={latestSet?.name ?? null}
          latestSetSlug={latestSet?.tcgdexSetId ?? null}
        />
      </div>

      {marqueeItems.length > 0 && (
        <div className="mb-6">
          <DatabaseMarquee items={marqueeItems} />
        </div>
      )}

      {(risers.length > 0 || fallers.length > 0) && (
        <div className="mb-8">
          <DatabaseTrending risers={risers} fallers={fallers} />
        </div>
      )}

      <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/pokedex"
          className="group flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/60 hover:bg-primary/10"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Pokédex</p>
            <p className="text-xs text-muted-foreground">
              Ontdek elke Pokémon — stats, evoluties en alle kaarten.
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/verkoop-calculator/collectie"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Banknote className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Collectie Inkoop</p>
            <p className="text-xs text-muted-foreground">
              Verkoop je kaarten aan ons — direct een eerlijke prijs.
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <KaartenSearch>
        <div className="space-y-12">
          {sortedSeries.map((s) => (
            <section key={s.id}>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-foreground">{s.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {s.cardSets.length} {s.cardSets.length === 1 ? "set" : "sets"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {s.cardSets.map((set) => (
                  <Link
                    key={set.id}
                    href={`/kaarten/${set.tcgdexSetId}`}
                    className="glass-subtle group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:ring-2 hover:ring-primary/30"
                  >
                    <div className="relative flex h-32 items-center justify-center rounded-xl bg-muted/40 p-3">
                      {set.logoUrl ? (
                        <Image
                          src={set.logoUrl}
                          alt={set.name}
                          width={200}
                          height={110}
                          className="max-h-full w-auto object-contain"
                          unoptimized
                        />
                      ) : (
                        <Layers className="size-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{set.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {set.cardCount ?? "?"} kaarten
                        {set.releaseDate && ` · ${new Date(set.releaseDate).getFullYear()}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </KaartenSearch>
    </div>
  );
}
