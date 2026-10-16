import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { PokedexHeader } from "@/components/pokedex/pokedex-header";
import { PokedexProfile } from "@/components/pokedex/pokedex-profile";
import { PokedexStats } from "@/components/pokedex/pokedex-stats";
import { PokedexEvolutionChain } from "@/components/pokedex/pokedex-evolution-chain";
import { PokedexTabs } from "@/components/pokedex/pokedex-tabs";
import { PokedexCardsGrid, type PokedexCard } from "@/components/pokedex/pokedex-cards-grid";
import { parsePokedexSlug } from "@/lib/pokeapi/slug";
import { getPokemon, getSpecies, getEvolutionChain } from "@/lib/pokeapi/client";
import { pickFlavorText } from "@/lib/pokeapi/flavor-text";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { getCardImageUrl } from "@/lib/card-image";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { hasReverseHoloSignal } from "@/lib/buyback-pricing";
import { PunchCard } from "@/components/ploy/punch-card";

export const revalidate = 86400; // 1d — species data is immutable upstream

interface Props {
  params: Promise<{ slug: string }>;
}

/** Find the best display name for a species for a given locale, falling
 * back through NL → EN → raw PokéAPI name. */
function pickName(species: Awaited<ReturnType<typeof getSpecies>>, locale: "nl" | "en"): string {
  if (!species) return "";
  const nl = species.names.find((n) => n.language.name === "nl");
  if (locale === "nl" && nl) return nl.name;
  const en = species.names.find((n) => n.language.name === "en");
  return en?.name ?? species.name;
}

function pickGenus(species: Awaited<ReturnType<typeof getSpecies>>, locale: "nl" | "en"): string | null {
  if (!species) return null;
  const nl = species.genera.find((g) => g.language.name === "nl");
  if (locale === "nl" && nl) return nl.genus;
  const en = species.genera.find((g) => g.language.name === "en");
  return en?.genus ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parsePokedexSlug(slug);
  if (!parsed) return { title: "Pokédex — Cards Center" };
  const species = await getSpecies(parsed.dexId);
  if (!species) return { title: "Pokédex — Cards Center" };
  const locale = (await getLocale()) as "nl" | "en";
  const name = pickName(species, locale);
  return {
    title: `${name} #${parsed.dexId} — Pokédex — Cards Center`,
    description: `Ontdek alles over ${name}: alle kaarten in de Cards Center database, types, stats en evoluties.`,
  };
}

/** Pokédex-detail (design-pass Fase E): kop met artwork op pastel, pil-tabs, witte kaarten. */
export default async function PokedexPage({ params }: Props) {
  const { slug } = await params;
  const parsed = parsePokedexSlug(slug);
  if (!parsed) notFound();

  const locale = ((await getLocale()) as "nl" | "en") ?? "nl";
  const t = await getTranslations("pokedex");
  const tBc = await getTranslations("breadcrumbs");

  // Fetch Pokémon + species in parallel — both are 1-hop PokéAPI calls.
  const [pokemon, species] = await Promise.all([getPokemon(parsed.dexId), getSpecies(parsed.dexId)]);
  if (!pokemon || !species) notFound();

  // Evolution chain is a second hop (URL from species). Fetch in parallel
  // with the DB query for related cards.
  const englishName = species.names.find((n) => n.language.name === "en")?.name ?? species.name;

  const [evolutionChain, relatedCardsRaw] = await Promise.all([
    getEvolutionChain(species.evolution_chain.url),
    prisma.card.findMany({
      // Brede DB-match op substring; de precieze woordgrens-check gebeurt in
      // JS hieronder. Dekt ook duo-kaarten ("Pikachu & Zekrom-GX") en
      // suffix-vormen ("Reshiram-GX", "Dark Pikachu") die de oude
      // spatie-patronen misten.
      where: { name: { contains: englishName } },
      select: {
        id: true,
        name: true,
        localId: true,
        rarity: true,
        imageUrl: true,
        imageUrlFull: true,
        imageMirrorKey: true,
        variants: true,
        // Velden voor de Marktprijs-formule
        priceAvg: true,
        priceLow: true,
        priceTrend: true,
        priceAvg7: true,
        priceAvg30: true,
        priceReverseAvg: true,
        priceReverseLow: true,
        priceReverseTrend: true,
        priceReverseAvg7: true,
        priceTcgplayerNormalMarket: true,
        priceTcgplayerHolofoilMarket: true,
        priceTcgplayerReverseMarket: true,
        priceTcgplayerReverseMid: true,
        priceOverrideAvg: true,
        priceOverrideReverseAvg: true,
        cardSet: {
          select: { name: true, tcgdexSetId: true, releaseDate: true },
        },
      },
      take: 500,
    }),
  ]);

  // Woordgrens-filter: "Mew" mag niet matchen op "Mewtwo", maar "Reshiram"
  // moet wel matchen op "Pikachu & Reshiram-GX".
  const boundaryRe = new RegExp(`(^|[^a-z])${escapeRegex(englishName)}([^a-z]|$)`, "i");

  const relatedCards: PokedexCard[] = relatedCardsRaw
    .filter((c) => boundaryRe.test(c.name) && c.cardSet.tcgdexSetId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      localId: c.localId,
      rarity: c.rarity,
      imageUrl: getCardImageUrl(c, "low"),
      setName: c.cardSet.name,
      setSlug: c.cardSet.tcgdexSetId!,
      releaseDate: c.cardSet.releaseDate,
      marktprijs: getMarktprijs(c),
      // Alleen RH-prijs tonen als er een echt reverse-holo printing bestaat.
      marktprijsRH: hasReverseHoloSignal({ ...c, releaseDate: c.cardSet.releaseDate }) ? getMarktprijsReverseHolo(c) : null,
    }));

  const flavorText = pickFlavorText(species.flavor_text_entries, locale);
  const genus = pickGenus(species, locale);

  const cardsTab =
    relatedCards.length > 0 ? (
      <PokedexCardsGrid cards={relatedCards} />
    ) : (
      <PunchCard className="bg-white p-12 text-center text-sm text-[var(--foreground)]/60" dot="var(--border)">
        <Layers className="mx-auto mb-3 size-8 text-[var(--foreground)]/30" />
        {t("noCardsYet")}
      </PunchCard>
    );

  const infoTab = (
    <div className="space-y-4">
      <PokedexProfile pokemon={pokemon} species={species} flavorText={flavorText} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PokedexStats stats={pokemon.stats} />
        {evolutionChain && <PokedexEvolutionChain chain={evolutionChain.chain} />}
      </div>
    </div>
  );

  return (
    <div className="cc-landing overflow-clip">
      <ScrollToTop />
      <section className="flex justify-center px-4 pb-16 pt-4 sm:px-5 lg:px-6 lg:pb-24 lg:pt-8">
        <div className="w-full max-w-6xl">
          <Link href="/pokedex" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]/55 no-underline transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft className="size-4" /> {tBc("pokedex")}
          </Link>
          <PokedexHeader pokemon={pokemon} species={species} genus={genus} />
          <PokedexTabs cardsLabel={t("tabCards", { count: relatedCards.length })} infoLabel={t("tabInfo")} cardsContent={cardsTab} infoContent={infoTab} defaultTab={relatedCards.length > 0 ? "cards" : "info"} />
        </div>
      </section>
    </div>
  );
}
