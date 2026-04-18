import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { KaartenSearch } from "@/components/card/kaarten-search";
import { Layers } from "lucide-react";

export const metadata: Metadata = {
  title: "Pokémon kaarten — Cards Center",
  description:
    "Bekijk alle Pokémon kaarten per set. Vergelijk prijzen, zie wat er nu te koop is en zet kaarten op je watchlist.",
};

export const revalidate = 3600; // re-render hourly

export default async function CardsOverviewPage() {
  // Only series that actually have cards in our local DB.
  // "tcgp" = Pokémon TCG Pocket (mobile game) — different product, excluded.
  const series = await prisma.series.findMany({
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
  });

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Kaarten" }]} />

      <header className="mb-10 mt-2">
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
