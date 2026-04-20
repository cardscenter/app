import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cardSlug, localIdFromSlug } from "@/lib/card-helpers";
import { syncSingleCard } from "@/lib/pokewallet/sync";
import { getCardImageUrl } from "@/lib/card-image";
import { CardWatchlistButton } from "@/components/card/card-watchlist-button";
import { CardPricePanel, type VariantPricing, type ExtraVariant } from "@/components/card/card-price-panel";
import { basePokemonName } from "@/lib/pokeapi/base-name";
import { pokedexSlug } from "@/lib/pokeapi/slug";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
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
  const marktprijs = getMarktprijs(card);
  return {
    title: `${card.name} — ${set.name} #${card.localId} — Cards Center`,
    description: marktprijs
      ? `${card.name} (${set.name}) — marktwaarde €${marktprijs.toFixed(2)}. Bekijk actuele aanbiedingen op Cards Center.`
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

  // On-demand pricing refresh — only when our cached price is stale (>24h).
  // Skips silently if the card has no pokewalletId mapping yet.
  const stale =
    !initialCard.priceUpdatedAt ||
    Date.now() - initialCard.priceUpdatedAt.getTime() > 24 * 60 * 60 * 1000;
  if (stale) {
    await syncSingleCard(initialCard.id).catch(() => {
      /* best-effort: don't block page render on a refresh miss */
    });
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
  // When getMarktprijs corrects raw CardMarket avg by >60% (spike detection
  // or extreme TCGPlayer mismatch), we know the underlying idProduct is
  // corrupt — show Marktprijs as `avg` but suppress the other raw stats
  // (low/trend/avg7/avg30) since they come from the same poisoned product.
  const isCorrupted = (raw: number | null | undefined, display: number | null) =>
    raw != null && display != null && raw > 0 && display < raw / 2.5;

  const pricingVariants: VariantPricing[] = [];
  if (cm) {
    const rarity = (card.rarity ?? "").toLowerCase();
    // "Has base" / "has foil" should require a meaningful price (avg or avg30),
    // not just any field. Without this, sparse foil data (e.g. only low-holo
    // filled) tricks the UI into showing an empty "Holo" variant.
    const hasBase = (cm.avg !== null && cm.avg > 0) || (cm.avg30 !== null && cm.avg30 > 0);
    // Reverse holo only physically exists on cards that ALSO have a non-
    // foil print. When TCGdex says variants.normal === false (holo-only
    // promo like SWSH020, XY84), CardMarket's stray rolling averages are
    // mis-labeled listings — ignore them entirely.
    //
    // Among cards that CAN have a reverse, the signal has two tiers:
    //   1. Active avg-holo — strong evidence, always accept.
    //   2. Historical avg30-holo only — weaker, accept only when TCGdex's
    //      variants.holo !== false. Modern sets (Twilight Masquerade,
    //      Prismatic Evolutions) pass tier 1; the tier-2 gate protects
    //      against phantom reverses on older promo sets.
    const hasActiveFoil = cm["avg-holo"] !== null && cm["avg-holo"] > 0;
    // Pokewallet's CardMarket-RH faalt vaak voor cards met idProduct-collisions
    // (bv. 151 Bulbasaur commons hebben TP Reverse maar CM RH = null). Accepteer
    // ook als TCGPlayer Reverse Holofoil pricing beschikbaar is.
    const hasTcgplayerReverse =
      (card.priceTcgplayerReverseMarket ?? card.priceTcgplayerReverseMid ?? 0) > 0;
    // TCGdex's variants-flags zijn soms volledig verkeerd voor hele sets (bv.
    // 151 Gengar #094 heeft álle variants=false terwijl er duidelijk een normal
    // én RH bestaat met echt volume). Override de holo-only-promo gate als CM
    // ZOWEL normal-volume (avg + low) als RH-volume (avg-holo + low-holo) heeft.
    const hasStrongNormalVolume = cm.avg !== null && cm.avg > 0 && cm.low !== null && cm.low > 0;
    const hasStrongFoilVolume = hasActiveFoil && cm["low-holo"] !== null && cm["low-holo"] > 0;
    const marketDataProvesDualPrint = hasStrongNormalVolume && hasStrongFoilVolume;
    const canHaveReverse = variants.normal !== false || marketDataProvesDualPrint;
    // hasFoil vereist een STERK RH-signaal. Expliciete TCGdex-bevestiging
    // (variants.reverse=true) altijd vertrouwen — óók op Holo Rares die
    // variants.normal=false hebben maar wél een reverse-holo print bezitten
    // (bv. Octillery swsh5 #37). Voor overige signalen (TP, CM-volume) blijft
    // de canHaveReverse-gate actief om pokewallet-lekkage uit te filteren.
    const isModernSet = (set.releaseDate ?? "") >= "2024-01-01";
    const hasFoil =
      variants.reverse === true ||
      (canHaveReverse && (
        hasTcgplayerReverse ||
        (isModernSet && hasStrongFoilVolume)
      ));

    // "Inherently foil" = the card ONLY exists as foil (no non-foil print).
    // We need `holo=true` AND `normal=false` — if BOTH holo+normal are true
    // the card has a dual print (common for promos like McDonald's Pikachu)
    // and both should render as separate variants.
    const variantsSayHoloOnly = variants.holo === true && variants.normal === false;
    // "holo" match vangt "Holo Rare" / "Rare Holo" van oude sets (Call of
    // Legends, Base Set) op, waar TCGdex vaak variants.normal=true (fout) zet
    // terwijl de kaart feitelijk alleen als holo bestaat.
    const raritySaysHoloOnly =
      /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/.test(rarity);
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
        // For inherently-foil cards: use Marktprijs blender with all the
        // foil-variant fields + TCGPlayer holofoil sanity check.
        const holoDisplay = getMarktprijs({
          priceAvg: cm["avg-holo"],
          priceLow: cm["low-holo"],
          priceTrend: cm["trend-holo"],
          priceAvg7: cm["avg7-holo"],
          priceAvg30: cm["avg30-holo"],
          priceTcgplayerHolofoilMarket: card.priceTcgplayerHolofoilMarket,
          priceTcgplayerNormalMarket: card.priceTcgplayerNormalMarket,
          rarity: card.rarity,
          priceOverrideAvg: card.priceOverrideAvg,
        });
        const corrupted = isCorrupted(cm["avg-holo"], holoDisplay);
        pricingVariants.push({
          key: "normal",
          label: "Holo",
          avg: holoDisplay ?? cm["avg-holo"],
          low: corrupted ? null : cm["low-holo"],
          trend: corrupted ? null : cm["trend-holo"],
          avg1: corrupted ? null : cm["avg1-holo"],
          avg7: corrupted ? null : cm["avg7-holo"],
          avg30: corrupted ? null : cm["avg30-holo"],
        });
      } else if (hasBase) {
        const baseDisplay = getMarktprijs({
          priceAvg: cm.avg,
          priceLow: cm.low,
          priceTrend: cm.trend,
          priceAvg7: cm.avg7,
          priceAvg30: cm.avg30,
          priceTcgplayerHolofoilMarket: card.priceTcgplayerHolofoilMarket,
          priceTcgplayerNormalMarket: card.priceTcgplayerNormalMarket,
          rarity: card.rarity,
          priceOverrideAvg: card.priceOverrideAvg,
        });
        const corrupted = isCorrupted(cm.avg, baseDisplay);
        pricingVariants.push({
          key: "normal",
          label: "Holo",
          avg: baseDisplay ?? cm.avg,
          low: corrupted ? null : cm.low,
          trend: corrupted ? null : cm.trend,
          avg1: corrupted ? null : cm.avg1,
          avg7: corrupted ? null : cm.avg7,
          avg30: corrupted ? null : cm.avg30,
        });
      } else {
        // No CardMarket data at all — common for older Rare Holo / Holo Rare
        // cards (Call of Legends, classic base sets). Fall back to TCGPlayer
        // Holofoil pricing via getMarktprijs (which handles EU-tier adjustment).
        const tpOnlyDisplay = getMarktprijs({
          priceAvg: null,
          priceTcgplayerHolofoilMarket: card.priceTcgplayerHolofoilMarket,
          priceTcgplayerNormalMarket: card.priceTcgplayerNormalMarket,
          rarity: card.rarity,
          priceOverrideAvg: card.priceOverrideAvg,
        });
        if (tpOnlyDisplay != null && tpOnlyDisplay > 0) {
          pricingVariants.push({
            key: "normal",
            label: "Holo",
            avg: tpOnlyDisplay,
            low: null, trend: null, avg1: null, avg7: null, avg30: null,
          });
        }
      }

      // Inherently-foil cards can ALSO have a separate reverse-holo printing
      // (modern Holo Rares like Octillery swsh5 #37). If the RH signal says
      // it exists, add it as a second variant.
      if (hasFoil) {
        const reverseDisplay = getMarktprijsReverseHolo({
          priceReverseAvg: cm["avg-holo"],
          priceReverseLow: cm["low-holo"],
          priceReverseTrend: cm["trend-holo"],
          priceReverseAvg7: cm["avg7-holo"],
          priceReverseAvg30: cm["avg30-holo"],
          priceTcgplayerReverseMarket: card.priceTcgplayerReverseMarket,
          priceTcgplayerReverseMid: card.priceTcgplayerReverseMid,
          priceOverrideReverseAvg: card.priceOverrideReverseAvg,
        });
        if (reverseDisplay != null && reverseDisplay > 0) {
          const corrupted = card.priceOverrideReverseAvg == null &&
            isCorrupted(cm["avg-holo"], reverseDisplay);
          pricingVariants.push({
            key: "reverse",
            label: "Reverse Holo",
            avg: reverseDisplay,
            low: corrupted ? null : cm["low-holo"],
            trend: corrupted ? null : cm["trend-holo"],
            avg1: corrupted ? null : cm["avg1-holo"],
            avg7: corrupted ? null : cm["avg7-holo"],
            avg30: corrupted ? null : cm["avg30-holo"],
          });
        }
      }
    } else {
      // Regular card: Normal (avg) + Reverse Holo (avg-holo) when both exist
      if (hasBase) {
        const baseDisplay = getMarktprijs({
          priceAvg: cm.avg,
          priceLow: cm.low,
          priceTrend: cm.trend,
          priceAvg7: cm.avg7,
          priceAvg30: cm.avg30,
          priceTcgplayerNormalMarket: card.priceTcgplayerNormalMarket,
          priceTcgplayerHolofoilMarket: card.priceTcgplayerHolofoilMarket,
          rarity: card.rarity,
          priceOverrideAvg: card.priceOverrideAvg,
        });
        // Als override actief is, is Marktprijs volledig vervangen en komen de
        // raw CM-stats van de verkeerde product-mapping — die nullen we ook weg.
        const corrupted = card.priceOverrideAvg != null || isCorrupted(cm.avg, baseDisplay);
        pricingVariants.push({
          key: "normal",
          label: "Normal",
          avg: baseDisplay ?? cm.avg,
          low: corrupted ? null : cm.low,
          trend: corrupted ? null : cm.trend,
          avg1: corrupted ? null : cm.avg1,
          avg7: corrupted ? null : cm.avg7,
          avg30: corrupted ? null : cm.avg30,
        });
      }
      if (hasFoil) {
        // Use outlier-resistant Marktprijs for RH (handles CM-null + TP fallback)
        const reverseDisplay = getMarktprijsReverseHolo({
          priceReverseAvg: cm["avg-holo"],
          priceReverseLow: cm["low-holo"],
          priceReverseTrend: cm["trend-holo"],
          priceReverseAvg7: cm["avg7-holo"],
          priceReverseAvg30: cm["avg30-holo"],
          priceTcgplayerReverseMarket: card.priceTcgplayerReverseMarket,
          priceTcgplayerReverseMid: card.priceTcgplayerReverseMid,
          priceOverrideReverseAvg: card.priceOverrideReverseAvg,
        });
        // Ascended Heroes (me02.5): Pokemon + Energy commons/uncommons hebben
        // TWEE RH-finishes (Ball + Energy Reverse Holo). Trainers hebben gewoon
        // de standaard Reverse Holo finish. Pokewallet's CM-data heeft géén
        // split tussen Ball/Energy, dus we tonen één gecombineerd label.
        const isAhDualReverse =
          set.tcgdexSetId === "me02.5" && (gameplay?.category === "Pokemon" || gameplay?.category === "Energy");
        const rhLabel: string =
          isDualHoloPromo ? "Holo"
          : isAhDualReverse ? "Ball / Energy Reverse Holo"
          : "Reverse Holo";
        const corrupted = isCorrupted(cm["avg-holo"], reverseDisplay);
        pricingVariants.push({
          key: "reverse",
          label: rhLabel,
          avg: reverseDisplay,
          low: corrupted ? null : cm["low-holo"],
          trend: corrupted ? null : cm["trend-holo"],
          avg1: corrupted ? null : cm["avg1-holo"],
          avg7: corrupted ? null : cm["avg7-holo"],
          avg30: corrupted ? null : cm["avg30-holo"],
        });
      }
    }
  }

  // Special-variant pricing (Master Ball / Poke Ball patterns).
  // Pokewallet returnt deze als aparte cards met eigen TCGPlayer Holofoil
  // pricing (CardMarket-data is een copy van de basis, dus onbruikbaar).
  // Tijdens sync slaan we ze op als JSON-blob op de basis-card.
  const extraVariants: ExtraVariant[] = (() => {
    if (!card.priceVariantsJson) return [];
    try {
      type RawVariant = { label: string; tcgUsd: number | null };
      const raw = JSON.parse(card.priceVariantsJson) as RawVariant[];
      const USD_TO_EUR = 0.92;
      // Rare-tier adjustment voor pattern variants — ze circuleren niet in
      // bulk-bins, dus kleine EU-discount tov TP USD prijzen.
      const tierAdjust = (eur: number) => {
        if (eur < 1) return 0.8;
        if (eur < 5) return 0.9;
        if (eur < 20) return 1.0;
        return 1.1;
      };
      return raw
        .filter((v): v is { label: string; tcgUsd: number } => v.tcgUsd != null && v.tcgUsd > 0)
        .map((v) => {
          const baseEur = v.tcgUsd * USD_TO_EUR;
          const priceEur = Math.round(baseEur * tierAdjust(baseEur) * 100) / 100;
          return {
            key: v.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
            label: v.label,
            priceEur,
          };
        });
    } catch {
      return [];
    }
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
