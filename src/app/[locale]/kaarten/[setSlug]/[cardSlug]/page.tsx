import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cardSlug, localIdFromSlug } from "@/lib/tcgdex/slug";
import { enrichCard } from "@/lib/tcgdex/enrich-card";
import { getCard } from "@/lib/tcgdex/client";
import { mergeGameplayDetails } from "@/lib/tcgdex/gameplay";
import { getMergedPricing } from "@/lib/tcgdex/pricing";
import { getCardImageUrl } from "@/lib/tcgdex/card-image";
import { CardWatchlistButton } from "@/components/card/card-watchlist-button";
import { CardPricePanel, type VariantPricing } from "@/components/card/card-price-panel";
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
    select: { id: true, name: true, tcgdexSetId: true, series: { select: { name: true } } },
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
  const [activeListings, activeAuctions, activeClaims, recentSales, siblingCards, _unused, isWatched] =
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
      // Prev/next: load all siblings and pick neighbours in JS — needed
      // because SQLite would string-sort localId ("10" < "2") and TCGdex
      // mixes numeric + alphanumeric ids (e.g. "SWSH004").
      prisma.card.findMany({
        where: { cardSetId: set.id },
        select: { name: true, localId: true },
      }),
      Promise.resolve(null),
      session?.user?.id
        ? prisma.cardWatchlist.findUnique({
            where: { userId_cardId: { userId: session.user.id, cardId: card.id } },
          })
        : Promise.resolve(null),
    ]);

  // Natural-sort siblings, then find prev/next relative to this card.
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

  // Full card for gameplay details — TCGdex first, pokemontcg.io fallback
   // for any fields TCGdex left empty. Both are cached 24h.
  const tcgCardRaw = await getCard(card.id);
  const tcgCard = await mergeGameplayDetails(tcgCardRaw, card.id);

  // PokéAPI animated sprite. TCGdex's dexId is sometimes wrong (e.g. Mega
   // Absol ex was tagged dexId 351 / Castform), so we prefer to look up the
   // species by its cleaned card name and only fall back to dexId when the
   // name lookup fails. Mega / VMAX / G-Max forms resolve their own variety
   // id via /pokemon-species/{id}/varieties.
  const spriteUrl = await (async () => {
    const rawName = tcgCard?.name ?? card.name;
    const stage = (tcgCard?.stage ?? "").toLowerCase();
    const lowerName = rawName.toLowerCase();

    // Form detection
    let targetSuffix: string | null = null;
    if (/\bmega\b/.test(lowerName) || stage === "mega") targetSuffix = "mega";
    else if (/\bvmax\b/.test(lowerName) || stage === "vmax") targetSuffix = "gmax";
    else if (/\bgigantamax\b|\bg-?max\b/.test(lowerName)) targetSuffix = "gmax";

    // Clean the card name to the plain Pokémon species slug.
    //   "Mega Absol ex" → "absol"
    //   "Charizard VMAX" → "charizard"
    //   "Mr. Mime" → "mr-mime", "Farfetch'd" → "farfetchd"
    const speciesSlug = rawName
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip diacritics (Flabébé)
      .replace(/\b(mega|vmax|vstar|v-?union|gx|ex|v|break|lv\.?x|tag team|prime|legend)\b/gi, "")
      .replace(/[♀♂]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[.']/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    async function resolveViaSpecies(speciesRef: string | number): Promise<number | null> {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesRef}`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) return null;
        const data = await res.json() as {
          id: number;
          varieties?: { pokemon: { name: string; url: string } }[];
        };
        if (!targetSuffix) return data.id;
        const match = data.varieties?.find((v) => v.pokemon.name.endsWith(`-${targetSuffix}`));
        if (!match) return data.id;
        const varietyId = match.pokemon.url.match(/\/pokemon\/(\d+)\/?$/)?.[1];
        return varietyId ? parseInt(varietyId, 10) : data.id;
      } catch { return null; }
    }

    // 1) Try species by slug (most reliable)
    let id: number | null = speciesSlug ? await resolveViaSpecies(speciesSlug) : null;
    // 2) Fallback to TCGdex's dexId if slug lookup failed
    if (!id && tcgCard?.dexId?.[0]) {
      id = await resolveViaSpecies(tcgCard.dexId[0]);
    }
    if (!id) return null;
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
  })();
  const setWithDate = await prisma.cardSet.findUnique({
    where: { id: set.id },
    select: { releaseDate: true },
  });

  // Daily price-history for the chart — last 30 entries, ascending by date.
  const priceHistoryRows = await prisma.cardPriceHistory.findMany({
    where: { cardId: card.id },
    orderBy: { date: "asc" },
    take: 60, // safety cap
  });
  const priceHistory = priceHistoryRows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    normal: r.priceNormal,
    reverse: r.priceReverse,
  }));

  // "Meer kaarten van [base]" — extract the plain Pokémon/Trainer name.
  // For Pokémon cards we also strip possessive + thematic prefixes so
  // "Team Aqua's Kyogre", "Lillie's Clefairy", "Dark Gyarados", "Shining
  // Magikarp" all resolve back to the base species ("Kyogre", "Clefairy"...).
  // Trainer/Energy names are left intact — "Professor's Research" is a
  // complete card name, not a possessive.
  const isPokemon = tcgCard?.category === "Pokemon" || !tcgCard?.category; // assume Pokémon if unknown
  let baseName = (tcgCard?.name ?? card.name)
    .replace(/\b(mega|vmax|vstar|v-?union|gx|ex|v|break|lv\.?x|tag team|prime|legend)\b/gi, "")
    .replace(/[♀♂]/g, "");
  if (isPokemon) {
    baseName = baseName
      .replace(/^.+?'s\s+/i, "")                          // "Team Aqua's ", "Lillie's "
      .replace(/^(dark|light|shining|radiant|shiny)\s+/i, ""); // "Dark Gyarados", "Shining Magikarp"
  }
  baseName = baseName.replace(/\s+/g, " ").trim();
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

  const types: string[] = tcgCard?.types ?? (card.types ? JSON.parse(card.types) : []);
  const variants: Record<string, boolean> = card.variants ? JSON.parse(card.variants) : {};
  const variantLabels = Object.entries(variants)
    .filter(([, v]) => v)
    .map(([k]) => ({ holo: "Holo", normal: "Normal", reverse: "Reverse Holo", firstEdition: "1st Edition", wPromo: "W Promo" }[k] ?? k));

  // Variant-aware pricing via the merged helper (TCGdex first, pokemontcg.io
  // fallback). Variant labels are inferred from rarity + which fields are
  // populated, not from TCGdex's `variants.reverse` flag (unreliable on
  // modern sets).
  const cm = await getMergedPricing(card.id);
  const pricingVariants: VariantPricing[] = [];
  if (cm) {
    const rarity = (card.rarity ?? "").toLowerCase();
    const hasBase = cm.avg !== null || cm.low !== null;
    const hasFoil = cm["avg-holo"] !== null || cm["low-holo"] !== null;

    // "avg" is always the non-reverse-holo printing. Its label depends on
    // rarity: Common/Uncommon/plain-Rare → Normal; Holo Rare / ex / special
    // → the card's actual foil variant (no separate flat version exists).
    const isInherentlyFoil =
      variants.holo ||
      /\b(holo|hyper|ultra|full art|illustration|special|double|amazing|radiant|shiny|secret|rainbow)\b/.test(rarity);

    if (hasBase) {
      pricingVariants.push({
        key: "normal",
        label: isInherentlyFoil ? "Holo" : "Normal",
        avg: cm.avg, low: cm.low, trend: cm.trend,
        avg1: cm.avg1, avg7: cm.avg7, avg30: cm.avg30,
      });
    }

    // "avg-holo" is the Reverse Holo printing for commons/uncommons/plain-rares,
    // and the Reverse-Holo-of-Holo for cards that are inherently foil (rare).
    if (hasFoil) {
      pricingVariants.push({
        key: "reverse",
        label: "Reverse Holo",
        avg: cm["avg-holo"], low: cm["low-holo"], trend: cm["trend-holo"],
        avg1: cm["avg1-holo"], avg7: cm["avg7-holo"], avg30: cm["avg30-holo"],
      });
    }
  }

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
            {/* Chips: localId, rarity, HP, illustrator — prefer merged values
                from tcgCard which include pokemontcg.io fallback fields. */}
            {(() => {
              const cleanStr = (v: string | null | undefined) =>
                !v || v === "None" || v === "" ? null : v;
              const rarity = cleanStr(tcgCard?.rarity) ?? cleanStr(card.rarity);
              const hp = tcgCard?.hp ?? card.hp;
              const illustrator = cleanStr(tcgCard?.illustrator) ?? cleanStr(card.illustrator);
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

          {/* Gameplay details (attacks, abilities, weakness, etc.) */}
          {tcgCard && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-foreground">Speelgegevens</h2>
              <CardGameplayBlock
                category={tcgCard.category}
                stage={tcgCard.stage}
                evolveFrom={tcgCard.evolveFrom}
                dexId={tcgCard.dexId}
                attacks={tcgCard.attacks}
                abilities={tcgCard.abilities}
                weaknesses={tcgCard.weaknesses}
                resistances={tcgCard.resistances}
                retreat={tcgCard.retreat}
                regulationMark={tcgCard.regulationMark}
                legal={tcgCard.legal}
                trainerType={tcgCard.trainerType}
                energyType={tcgCard.energyType}
                effect={tcgCard.effect}
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
