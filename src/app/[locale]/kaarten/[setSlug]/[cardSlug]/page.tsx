import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import { cardSlug, localIdFromSlug } from "@/lib/tcgdex/slug";
import { enrichCard } from "@/lib/tcgdex/enrich-card";
import { CardWatchlistButton } from "@/components/card/card-watchlist-button";
import { ChevronLeft, ChevronRight, Tag, Hash, Palette } from "lucide-react";

export const revalidate = 1800; // re-render every 30min so prices stay fresh

interface Props {
  params: Promise<{ setSlug: string; cardSlug: string }>;
}

async function lookupCard(setSlug: string, cardSlug: string) {
  const localId = localIdFromSlug(cardSlug);
  if (!localId) return null;

  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId: setSlug },
    select: { id: true, name: true, tcgdexSetId: true, series: { select: { name: true } } },
  });
  if (!set) return null;

  const card = await prisma.card.findFirst({
    where: { cardSetId: set.id, localId },
  });
  if (!card) return null;

  return { set, card };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { setSlug, cardSlug } = await params;
  const result = await lookupCard(setSlug, cardSlug);
  if (!result) return { title: "Kaart niet gevonden — Cards Center" };
  const { card, set } = result;
  return {
    title: `${card.name} — ${set.name} #${card.localId} — Cards Center`,
    description: card.priceAvg
      ? `${card.name} (${set.name}) — CardMarket gemiddelde €${card.priceAvg.toFixed(2)}. Bekijk actuele aanbiedingen op Cards Center.`
      : `${card.name} (${set.name} #${card.localId}). Bekijk actuele aanbiedingen op Cards Center.`,
    openGraph: {
      title: `${card.name} — ${set.name}`,
      images: card.imageUrl ? [`${card.imageUrl}/high.webp`] : undefined,
    },
  };
}

export default async function CardDetailPage({ params }: Props) {
  const { setSlug, cardSlug: slug } = await params;
  const result = await lookupCard(setSlug, slug);
  if (!result) notFound();

  const { card: initialCard, set } = result;

  // Lazy-enrich on first view (or every 24h); mostly returns instantly from
  // the TCGdex client cache. Bump local view-count + lastViewedAt for cron
  // prioritization.
  const [enriched] = await Promise.all([
    enrichCard(initialCard.id),
    prisma.card.update({
      where: { id: initialCard.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }),
  ]);
  const card = enriched ?? initialCard;

  // Active marketplace items + prev/next + watchlist state in parallel
  const session = await auth();
  const [activeListings, activeAuctions, activeClaims, recentSales, prevCard, nextCard, isWatched] =
    await Promise.all([
      prisma.listing.findMany({
        where: { tcgdexId: card.id, status: "ACTIVE" },
        include: { seller: { select: { displayName: true, id: true } } },
        orderBy: { price: "asc" },
        take: 10,
      }),
      prisma.auction.findMany({
        where: { tcgdexId: card.id, status: "ACTIVE" },
        include: { seller: { select: { displayName: true, id: true } } },
        orderBy: { endTime: "asc" },
        take: 10,
      }),
      prisma.claimsaleItem.findMany({
        where: { tcgdexId: card.id, status: "AVAILABLE", claimsale: { status: "LIVE" } },
        include: { claimsale: { select: { id: true, title: true, sellerId: true, seller: { select: { displayName: true } } } } },
        orderBy: { price: "asc" },
        take: 10,
      }),
      prisma.shippingBundle.findMany({
        where: { listing: { tcgdexId: card.id }, status: "COMPLETED" },
        select: { totalItemCost: true, deliveredAt: true },
        orderBy: { deliveredAt: "desc" },
        take: 10,
      }),
      prisma.card.findFirst({
        where: { cardSetId: set.id, localId: { lt: card.localId } },
        orderBy: { localId: "desc" },
        select: { name: true, localId: true },
      }),
      prisma.card.findFirst({
        where: { cardSetId: set.id, localId: { gt: card.localId } },
        orderBy: { localId: "asc" },
        select: { name: true, localId: true },
      }),
      session?.user?.id
        ? prisma.cardWatchlist.findUnique({
            where: { userId_cardId: { userId: session.user.id, cardId: card.id } },
          })
        : Promise.resolve(null),
    ]);

  const types: string[] = card.types ? JSON.parse(card.types) : [];
  const variants: Record<string, boolean> = card.variants ? JSON.parse(card.variants) : {};
  const variantLabels = Object.entries(variants)
    .filter(([, v]) => v)
    .map(([k]) => ({ holo: "Holo", normal: "Normal", reverse: "Reverse Holo", firstEdition: "1st Edition", wPromo: "W Promo" }[k] ?? k));

  const pricing = card.priceAvg !== null
    ? {
        avg: card.priceAvg,
        low: card.priceLow,
        trend: card.priceTrend,
        avg7: card.priceAvg7,
        avg30: card.priceAvg30,
        updated: card.priceUpdatedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Kaarten", href: "/kaarten" },
          { label: set.name, href: `/kaarten/${set.tcgdexSetId}` },
          { label: card.name },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: Card image */}
        <div className="lg:col-span-1">
          <div className="relative aspect-[5/7] w-full overflow-hidden rounded-2xl bg-muted shadow-lg">
            {card.imageUrl ? (
              <Image
                src={`${card.imageUrl}/high.webp`}
                alt={card.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 33vw"
                priority
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                Geen afbeelding beschikbaar
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata + pricing + listings */}
        <div className="space-y-6 lg:col-span-2">
          <header>
            <p className="text-sm text-muted-foreground">{set.series.name} · {set.name}</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">{card.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Hash className="size-3.5" />{card.localId}</span>
              {card.rarity && <span className="inline-flex items-center gap-1"><Tag className="size-3.5" />{card.rarity}</span>}
              {card.illustrator && <span className="inline-flex items-center gap-1"><Palette className="size-3.5" />{card.illustrator}</span>}
              {card.hp && <span>· {card.hp} HP</span>}
              {types.length > 0 && <span>· {types.join(", ")}</span>}
            </div>
            {variantLabels.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Beschikbare varianten: {variantLabels.join(", ")}
              </p>
            )}
          </header>

          {/* Pricing */}
          {pricing && (
            <PricingInfoBlock pricing={pricing} variant="full" label="CardMarket marktwaarde" />
          )}

          {/* Card-level watchlist */}
          {session?.user?.id && (
            <CardWatchlistButton cardId={card.id} initialWatching={!!isWatched} />
          )}

          {/* Active marketplace items */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-foreground">Nu te koop op Cards Center</h2>

            {activeListings.length === 0 && activeAuctions.length === 0 && activeClaims.length === 0 ? (
              <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Deze kaart wordt momenteel niet aangeboden.
              </p>
            ) : (
              <div className="space-y-2">
                {activeListings.map((l) => (
                  <Link
                    key={l.id}
                    href={`/marktplaats/${l.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">Marktplaats · {l.condition}</p>
                      <p className="text-xs text-muted-foreground">{l.seller.displayName}</p>
                    </div>
                    <span className="font-bold text-foreground">€{l.price?.toFixed(2)}</span>
                  </Link>
                ))}
                {activeAuctions.map((a) => (
                  <Link
                    key={a.id}
                    href={`/veilingen/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">Veiling · {a.condition ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.seller.displayName} · eindigt {a.endTime.toLocaleDateString("nl-NL")}
                      </p>
                    </div>
                    <span className="font-bold text-foreground">
                      €{(a.currentBid ?? a.startingBid).toFixed(2)}
                    </span>
                  </Link>
                ))}
                {activeClaims.map((c) => (
                  <Link
                    key={c.id}
                    href={`/claimsales/${c.claimsale.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">Claimsale · {c.condition}</p>
                      <p className="text-xs text-muted-foreground">{c.claimsale.seller.displayName} · {c.claimsale.title}</p>
                    </div>
                    <span className="font-bold text-foreground">€{c.price.toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent sales on this platform */}
          {recentSales.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-foreground">Recent verkocht op Cards Center</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {recentSales.map((s, i) => (
                  <div key={i} className="rounded-xl bg-muted/30 p-3 text-center">
                    <p className="text-sm font-bold text-foreground">€{s.totalItemCost.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.deliveredAt?.toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Prev / next */}
      <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
        {prevCard ? (
          <Link
            href={`/kaarten/${set.tcgdexSetId}/${cardSlug(prevCard.name, prevCard.localId)}`}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            <span>#{prevCard.localId} {prevCard.name}</span>
          </Link>
        ) : <span />}
        <Link
          href={`/kaarten/${set.tcgdexSetId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Hele set bekijken
        </Link>
        {nextCard ? (
          <Link
            href={`/kaarten/${set.tcgdexSetId}/${cardSlug(nextCard.name, nextCard.localId)}`}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>#{nextCard.localId} {nextCard.name}</span>
            <ChevronRight className="size-4" />
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
