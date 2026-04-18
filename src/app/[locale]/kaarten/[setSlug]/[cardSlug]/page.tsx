import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cardSlug, localIdFromSlug } from "@/lib/tcgdex/slug";
import { enrichCard } from "@/lib/tcgdex/enrich-card";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";
import { CardWatchlistButton } from "@/components/card/card-watchlist-button";
import { CardPricePanel, type VariantPricing, type ExtraVariant } from "@/components/card/card-price-panel";
import { getSpecialVariantsForSet, parseExtraVariants } from "@/lib/tcgdex/special-variants";
import { basePokemonName } from "@/lib/pokeapi/base-name";
import { pokedexSlug } from "@/lib/pokeapi/slug";
import { getDisplayPrice, hasCardMarketDiscrepancy } from "@/lib/display-price";
import { TypeIconList } from "@/components/card/type-icon";
import { CardGameplayBlock } from "@/components/card/card-gameplay-block";
import { CardCarousel } from "@/components/card/card-carousel";
import { ChevronLeft, ChevronRight, Tag, Hash, Palette, Calendar, Heart } from "lucide-react";

export const revalidate = 1800; // re-render every 30min so prices stay fresh

interface Props {
  params: Promise<{ setSlug: string; cardSlug: string }>;
}

async function lookupCard(setSlug: string, cardSlug: string) {
  const localIdLower = localIdFromSlug(cardSlug);
  if (!localIdLower) return null;

  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId: setSlug },
    select: {
      id: true, name: true, tcgdexSetId: true, releaseDate: true,
      series: { select: { name: true } },
    },
  });
  if (!set) return null;

  // localId in the DB can be mixed-case (e.g. "SWSH004") while the URL slug
  // is always lowercase. Match both cases so the URL stays friendly.
  const card = await prisma.card.findFirst({
    where: {
      cardSetId: set.id,
      OR: [
        { localId: localIdLower },
        { localId: localIdLower.toUpperCase() },
      ],
    },
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
      ? `${card.name} (${set.name}) — marktwaarde €${card.priceAvg.toFixed(2)}. Bekijk actuele aanbiedingen op Cards Center.`
      : `${card.name} (${set.name} #${card.localId}). Bekijk actuele aanbiedingen op Cards Center.`,
    openGraph: {
      title: `${card.name} — ${set.name}`,
      images: (() => {
        const ogImg = getCardImageUrl(card, "high");
        return ogImg ? [ogImg] : undefined;
      })(),
    },
  };
}

export default async function CardDetailPage({ params }: Props) {
  const { setSlug, cardSlug: slug } = await params;
  const result = await lookupCard(setSlug, slug);
  if (!result) notFound();

  const { card: initialCard, set } = result;
  const session = await auth();

  // First-visit enrichment: only triggers external API calls if gameplayJson
  // is still null (never fully enriched). Otherwise this short-circuits
  // immediately. Pricing refresh is the cron's job.
  if (!initialCard.gameplayJson) {
    await enrichCard(initialCard.id);
  }

  // Now everything is pure DB — one query batch, no external API calls.
  const [
    card,
    _viewUpdate,
    activeListings,
    activeAuctions,
    activeClaims,
    recentSales,
    siblingCards,
    isWatched,
    priceHistoryRows,
  ] = await Promise.all([
    prisma.card.findUnique({ where: { id: initialCard.id } }),
    prisma.card.update({
      where: { id: initialCard.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }),
    prisma.listing.findMany({
      where: { tcgdexId: initialCard.id, status: "ACTIVE" },
      include: { seller: { select: { displayName: true, id: true } } },
      orderBy: { price: "asc" },
      take: 10,
    }),
    prisma.auction.findMany({
      where: { tcgdexId: initialCard.id, status: "ACTIVE" },
      include: { seller: { select: { displayName: true, id: true } } },
      orderBy: { endTime: "asc" },
      take: 10,
    }),
    prisma.claimsaleItem.findMany({
      where: { tcgdexId: initialCard.id, status: "AVAILABLE", claimsale: { status: "LIVE" } },
      include: { claimsale: { select: { id: true, title: true, sellerId: true, seller: { select: { displayName: true } } } } },
      orderBy: { price: "asc" },
      take: 10,
    }),
    prisma.shippingBundle.findMany({
      where: { listing: { tcgdexId: initialCard.id }, status: "COMPLETED" },
      select: { totalItemCost: true, deliveredAt: true },
      orderBy: { deliveredAt: "desc" },
      take: 10,
    }),
    prisma.card.findMany({
      where: { cardSetId: set.id },
      select: { name: true, localId: true },
    }),
    session?.user?.id
      ? prisma.cardWatchlist.findUnique({
          where: { userId_cardId: { userId: session.user.id, cardId: initialCard.id } },
        })
      : Promise.resolve(null),
    prisma.cardPriceHistory.findMany({
      where: { cardId: initialCard.id },
      orderBy: { date: "asc" },
      take: 60,
    }),
  ]);
  if (!card) notFound();

  // Parse the cached gameplay blob — no external API calls needed.
  const gameplay = card.gameplayJson ? JSON.parse(card.gameplayJson) as {
    category?: string;
    attacks?: { cost?: string[]; name: string; effect?: string; damage?: number | string }[];
    abilities?: { type: string; name: string; effect: string }[];
    weaknesses?: { type: string; value: string }[];
    resistances?: { type: string; value: string }[];
    retreat?: number;
    stage?: string;
    evolveFrom?: string;
    dexId?: number[];
    regulationMark?: string;
    legal?: { standard?: boolean; expanded?: boolean };
    trainerType?: string;
    energyType?: string;
    effect?: string;
  } : null;
  const spriteUrl = card.spriteUrl;

  // Natural-sort siblings
  const sortedSiblings = [...siblingCards].sort((a, b) => {
    const na = parseInt(a.localId, 10);
    const nb = parseInt(b.localId, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.localId.localeCompare(b.localId, undefined, { numeric: true });
  });
  const currentIdx = sortedSiblings.findIndex((c) => c.localId === card.localId);
  const prevCard = currentIdx > 0 ? sortedSiblings[currentIdx - 1] : null;
  const nextCard = currentIdx >= 0 && currentIdx < sortedSiblings.length - 1
    ? sortedSiblings[currentIdx + 1]
    : null;

  const setWithDate = set as { releaseDate: string | null };

  // Pricing for the UI — reconstruct the cardmarket-shaped blob from DB fields
  const cm = card.priceUpdatedAt ? {
    updated: card.priceUpdatedAt.toISOString(),
    avg: card.priceAvg, low: card.priceLow, trend: card.priceTrend,
    avg1: null, avg7: card.priceAvg7, avg30: card.priceAvg30,
    "avg-holo": card.priceReverseAvg, "low-holo": card.priceReverseLow,
    "trend-holo": card.priceReverseTrend,
    "avg1-holo": null, "avg7-holo": card.priceReverseAvg7, "avg30-holo": card.priceReverseAvg30,
  } : null;

  const priceHistory = priceHistoryRows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    normal: r.priceNormal,
    reverse: r.priceReverse,
  }));

  // "Meer kaarten van [base]" — strip suffixes, plus possessive + thematic
  // prefixes for Pokémon cards so "Team Aqua's Kyogre" etc. find siblings.
  const baseName = basePokemonName(card.name, gameplay?.category);
  const relatedCardsRaw = baseName.length >= 3
    ? await prisma.card.findMany({
        where: {
          id: { not: card.id },
          // Match either "Name" exactly or "<prefix> Name <suffix>" patterns
          OR: [
            { name: { equals: baseName } },
            { name: { startsWith: `${baseName} ` } },
            { name: { contains: ` ${baseName} ` } },
            { name: { endsWith: ` ${baseName}` } },
            { name: { startsWith: `Mega ${baseName}` } },
          ],
        },
        include: {
          cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
        },
        take: 40,
      })
    : [];
  // Sort newest-first by set release-date (string ISO compares lexicographically)
  const relatedCards = relatedCardsRaw
    .sort((a, b) => (b.cardSet.releaseDate ?? "").localeCompare(a.cardSet.releaseDate ?? ""))
    .map((c) => ({
      id: c.id,
      name: c.name,
      localId: c.localId,
      rarity: c.rarity,
      setName: c.cardSet.name,
      setSlug: c.cardSet.tcgdexSetId ?? "",
      imageUrl: getCardImageUrl(c, "low"),
    }))
    .filter((c) => c.setSlug);

  const types: string[] = card.types ? JSON.parse(card.types) : [];
  const variants: Record<string, boolean> = card.variants ? JSON.parse(card.variants) : {};
  const variantLabels = Object.entries(variants)
    .filter(([, v]) => v)
    .map(([k]) => ({ holo: "Holo", normal: "Normal", reverse: "Reverse Holo", firstEdition: "1st Edition", wPromo: "W Promo" }[k] ?? k));

  // `cm` already fetched in the big Promise.all above.
  //
  // "Inherently foil" cards (ex / V / VMAX / VSTAR / Double Rare / Illustration
  // Rare / Ultra Rare / etc.) only exist as foil on CardMarket. TCGdex still
  // surfaces an `avg` value for those — but it's noise from mis-SKU'd /
  // heavily damaged listings, not a real non-foil print. For these cards we
  // ignore `avg` entirely and use `avg-holo` as the single market price.
  const pricingVariants: VariantPricing[] = [];
  // Bad-data guard: when CardMarket's priceAvg disagrees with PriceCharting
  // by >5x, the whole CardMarket product is pointing at the wrong listing
  // (sealed box, different card, etc.) and every cm.* field is unreliable.
  // In that case null out the low/trend/avg1/avg7/avg30 stats so the panel
  // doesn't flash misleading history alongside the corrected main price.
  const cmUnreliable = hasCardMarketDiscrepancy({
    priceAvg: card.priceAvg,
    priceTrend: card.priceTrend,
    pricePriceChartingEur: card.pricePriceChartingEur,
    priceAvg7: card.priceAvg7,
  });
  if (cm) {
    const rarity = (card.rarity ?? "").toLowerCase();
    // "Has base" / "has foil" should require a meaningful price (avg or avg30),
    // not just any field. Without this, sparse foil data (e.g. only low-holo
    // filled) tricks the UI into showing an empty "Holo" variant.
    const hasBase = (cm.avg !== null && cm.avg > 0) || (cm.avg30 !== null && cm.avg30 > 0);
    const hasFoil = (cm["avg-holo"] !== null && cm["avg-holo"] > 0) || (cm["avg30-holo"] !== null && cm["avg30-holo"] > 0);

    // "Inherently foil" = the card ONLY exists as foil (no non-foil print).
    // We need `holo=true` AND `normal=false` — if BOTH holo+normal are true
    // the card has a dual print (common for promos like McDonald's Pikachu)
    // and both should render as separate variants.
    const variantsSayHoloOnly = variants.holo === true && variants.normal === false;
    const raritySaysHoloOnly =
      /\b(hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/.test(rarity);
    const isInherentlyFoil = variantsSayHoloOnly || raritySaysHoloOnly;
    // Dual holo/normal promos want a "Holo" label rather than "Reverse Holo"
    // — reverse-holo is specifically the partial-foil finish on commons/
    // uncommons, not the glossy-card treatment of these promos.
    const isDualHoloPromo = variants.holo === true && variants.normal === true;
    // We used to gate reverse-holo display on `variants.reverse`, but TCGdex
    // returns `false` incorrectly for whole modern sets (e.g. sv06 Twilight
    // Masquerade, sv08.5 Prismatic Evolutions). `hasFoil` already requires
    // a real CardMarket avg-holo price, which is a strong signal that the
    // variant physically exists.

    if (isInherentlyFoil) {
      // Prefer the foil fields only if they include a primary `avg` price.
      // Some inherently-foil cards (e.g. Hidden Fates Shiny Vault Poipole)
      // have their real price in the base `avg` field and only sparse reverse
      // data (low-holo, avg30-holo). In that case base is the single source.
      const foilHasAvg = cm["avg-holo"] !== null && cm["avg-holo"] > 0;
      if (foilHasAvg) {
        // For inherently-foil cards, the single variant represents the
        // foil product — blend with PriceCharting / priceTrend when it
        // crosses the expensive threshold.
        const holoDisplay = getDisplayPrice({
          priceAvg: cm["avg-holo"],
          priceTrend: cm["trend-holo"],
          pricePriceChartingEur: card.pricePriceChartingEur,
          priceAvg7: cm["avg7-holo"],
        });
        pricingVariants.push({
          key: "normal",
          label: "Holo",
          avg: holoDisplay ?? cm["avg-holo"],
          low: cm["low-holo"], trend: cm["trend-holo"],
          avg1: cm["avg1-holo"], avg7: cm["avg7-holo"], avg30: cm["avg30-holo"],
        });
      } else if (hasBase) {
        const baseDisplay = getDisplayPrice({
          priceAvg: cm.avg,
          priceTrend: cm.trend,
          pricePriceChartingEur: card.pricePriceChartingEur,
          priceAvg7: cm.avg7,
        });
        pricingVariants.push({
          key: "normal",
          label: "Holo",
          avg: baseDisplay ?? cm.avg,
          low: cmUnreliable ? null : cm.low,
          trend: cmUnreliable ? null : cm.trend,
          avg1: cmUnreliable ? null : cm.avg1,
          avg7: cmUnreliable ? null : cm.avg7,
          avg30: cmUnreliable ? null : cm.avg30,
        });
      }
    } else {
      // Regular card: Normal (avg) + Reverse Holo (avg-holo) when both exist
      if (hasBase) {
        const baseDisplay = getDisplayPrice({
          priceAvg: cm.avg,
          priceTrend: cm.trend,
          pricePriceChartingEur: card.pricePriceChartingEur,
          priceAvg7: cm.avg7,
        });
        pricingVariants.push({
          key: "normal",
          label: "Normal",
          avg: baseDisplay ?? cm.avg,
          low: cmUnreliable ? null : cm.low,
          trend: cmUnreliable ? null : cm.trend,
          avg1: cmUnreliable ? null : cm.avg1,
          avg7: cmUnreliable ? null : cm.avg7,
          avg30: cmUnreliable ? null : cm.avg30,
        });
      }
      if (hasFoil) {
        // Fall back to avg30-holo as displayed price if avg-holo is null
        // (happens on thinly-traded promos where the rolling 30d average
        // survives but the daily avg rolled off).
        const foilAvg = cm["avg-holo"] ?? cm["avg30-holo"];
        pricingVariants.push({
          key: "reverse",
          label: isDualHoloPromo ? "Holo" : "Reverse Holo",
          avg: foilAvg,
          low: cm["low-holo"],
          trend: cm["trend-holo"],
          avg1: cm["avg1-holo"], avg7: cm["avg7-holo"], avg30: cm["avg30-holo"],
        });
      }
    }
  }

  // Special-variant pricing (Poké Ball / Master Ball / Ball / Energy patterns)
  // — cached on Card.extraVariantsJson, labels + keys from the set config.
  const extraVariants: ExtraVariant[] = (() => {
    const setConfig = getSpecialVariantsForSet(set.tcgdexSetId);
    if (!setConfig) return [];
    const prices = parseExtraVariants(card.extraVariantsJson);
    return setConfig.variants
      .map((v) => {
        const priceEur = prices[v.key];
        return priceEur ? { key: v.key, label: v.labelNl, priceEur } : null;
      })
      .filter((v): v is ExtraVariant => v !== null);
  })();

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
        {/* Left: Card image — sticky on desktop so it stays visible while
            scrolling through listings and gameplay details. */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="relative aspect-[5/7] w-full overflow-hidden rounded-2xl bg-muted shadow-lg">
              {(() => {
                const imgSrc = getCardImageUrl(card, "high");
                return imgSrc ? (
                  <Image
                    src={imgSrc}
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
                );
              })()}
            </div>
            {session?.user?.id && (
              <CardWatchlistButton cardId={card.id} initialWatching={!!isWatched} />
            )}
          </div>
        </div>

        {/* Right: Metadata + pricing + gameplay + listings */}
        <div className="space-y-6 lg:col-span-2">
          <header className="relative">
            {spriteUrl && (
              <img
                src={spriteUrl}
                alt=""
                className="pointer-events-none absolute right-0 top-0 hidden lg:block"
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href={`/kaarten/${set.tcgdexSetId}`} className="hover:text-foreground">
                {set.series.name} · {set.name}
              </Link>
              {setWithDate?.releaseDate && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Calendar className="size-3" />
                  {new Date(setWithDate.releaseDate).toLocaleDateString("nl-NL", { year: "numeric", month: "long" })}
                </span>
              )}
            </div>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold text-foreground">
              <span>{card.name}</span>
              {types.length > 0 && <TypeIconList types={types} size={30} />}
            </h1>
            {/* Chips: localId, rarity, HP, illustrator. All from DB cache. */}
            {(() => {
              const cleanStr = (v: string | null | undefined) =>
                !v || v === "None" || v === "" ? null : v;
              const rarity = cleanStr(card.rarity);
              const hp = card.hp;
              const illustrator = cleanStr(card.illustrator);
              return (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                <Hash className="size-3" />{card.localId}
              </span>
              {rarity && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                  <Tag className="size-3" />{rarity}
                </span>
              )}
              {hp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400">
                  <Heart className="size-3" />{hp} HP
                </span>
              )}
              {illustrator && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                  <Palette className="size-3" />{illustrator}
                </span>
              )}
            </div>
              );
            })()}
            {variantLabels.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Beschikbare varianten: {variantLabels.join(", ")}
              </p>
            )}
          </header>

          {/* Pricing */}
          {pricingVariants.length > 0 ? (
            <CardPricePanel
              variants={pricingVariants}
              history={priceHistory}
              updated={cm?.updated ?? card.priceUpdatedAt?.toISOString() ?? null}
              extraVariants={extraVariants}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-muted-foreground">Marktwaarde</h3>
              <p className="mt-2 text-sm text-foreground">Geen actuele prijsdata beschikbaar.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Deze kaart wordt niet actief verhandeld op de Europese markt (komt vooral voor bij
                oudere promos en niet-Europese sets). De prijs wordt bepaald door wat verkopers op
                Cards Center vragen.
              </p>
            </div>
          )}

          {/* Sell to us CTA */}
          <Link
            href="/verkoop-calculator/collectie"
            className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/><path d="M2 12h20"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Verkoop deze kaart aan ons</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">Ontvang direct een eerlijke prijs via onze verkoop calculator</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-500"><path d="m9 18 6-6-6-6"/></svg>
          </Link>

          {/* Gameplay details (attacks, abilities, weakness, etc.) */}
          {gameplay && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-foreground">Speelgegevens</h2>
              <CardGameplayBlock
                category={gameplay.category}
                stage={gameplay.stage}
                evolveFrom={gameplay.evolveFrom}
                dexId={gameplay.dexId}
                attacks={gameplay.attacks}
                abilities={gameplay.abilities}
                weaknesses={gameplay.weaknesses}
                resistances={gameplay.resistances}
                retreat={gameplay.retreat}
                trainerType={gameplay.trainerType}
                energyType={gameplay.energyType}
                effect={gameplay.effect}
                pokedexHref={
                  gameplay.category === "Pokemon" && gameplay.dexId && gameplay.dexId.length > 0
                    ? `/pokedex/${pokedexSlug(baseName, gameplay.dexId[0])}`
                    : null
                }
              />
            </section>
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

      <CardCarousel title={`Meer kaarten van ${baseName}`} items={relatedCards} />
    </div>
  );
}
