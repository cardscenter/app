import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CardCarousel } from "@/components/card/card-carousel";
import { PokedexHero } from "@/components/pokedex/pokedex-hero";
import { PokedexStats } from "@/components/pokedex/pokedex-stats";
import { PokedexEvolutionChain } from "@/components/pokedex/pokedex-evolution-chain";
import { parsePokedexSlug } from "@/lib/pokeapi/slug";
import { getPokemon, getSpecies, getEvolutionChain } from "@/lib/pokeapi/client";
import { pickFlavorText } from "@/lib/pokeapi/flavor-text";
import { getCardImageUrl } from "@/lib/card-image";

export const revalidate = 86400; // 1d — species data is immutable upstream

interface Props {
  params: Promise<{ slug: string }>;
}

/** Find the best display name for a species for a given locale, falling
 * back through NL → EN → raw PokéAPI name. */
function pickName(
  species: Awaited<ReturnType<typeof getSpecies>>,
  locale: "nl" | "en"
): string {
  if (!species) return "";
  const nl = species.names.find((n) => n.language.name === "nl");
  if (locale === "nl" && nl) return nl.name;
  const en = species.names.find((n) => n.language.name === "en");
  return en?.name ?? species.name;
}

function pickGenus(
  species: Awaited<ReturnType<typeof getSpecies>>,
  locale: "nl" | "en"
): string | null {
  if (!species) return null;
  const nl = species.genera.find((g) => g.language.name === "nl");
  if (locale === "nl" && nl) return nl.genus;
  const en = species.genera.find((g) => g.language.name === "en");
  return en?.genus ?? null;
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
    description: `Ontdek alles over ${name}: types, stats, evoluties en alle kaarten die we in de Cards Center database hebben.`,
  };
}

export default async function PokedexPage({ params }: Props) {
  const { slug } = await params;
  const parsed = parsePokedexSlug(slug);
  if (!parsed) notFound();

  const locale = ((await getLocale()) as "nl" | "en") ?? "nl";
  const t = await getTranslations("pokedex");
  const tBc = await getTranslations("breadcrumbs");

  // Fetch Pokémon + species in parallel — both are 1-hop PokéAPI calls.
  const [pokemon, species] = await Promise.all([
    getPokemon(parsed.dexId),
    getSpecies(parsed.dexId),
  ]);
  if (!pokemon || !species) notFound();

  // Evolution chain is a second hop (URL from species). Fetch in parallel
  // with the DB query for related cards.
  const displayName = pickName(species, locale);
  const englishName =
    species.names.find((n) => n.language.name === "en")?.name ?? species.name;

  const [evolutionChain, relatedCardsRaw] = await Promise.all([
    getEvolutionChain(species.evolution_chain.url),
    prisma.card.findMany({
      where: {
        // Match cards whose name equals or contains the species (English)
        // name — same patterns the card-detail page uses for its siblings
        // carousel.
        OR: [
          { name: { equals: englishName } },
          { name: { startsWith: `${englishName} ` } },
          { name: { contains: ` ${englishName} ` } },
          { name: { endsWith: ` ${englishName}` } },
          { name: { startsWith: `Mega ${englishName}` } },
        ],
      },
      include: {
        cardSet: { select: { name: true, tcgdexSetId: true, releaseDate: true } },
      },
      take: 100,
    }),
  ]);

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

  const flavorText = pickFlavorText(species.flavor_text_entries, locale);
  const genus = pickGenus(species, locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: tBc("pokedex"), href: "/pokedex" },
          { label: displayName },
        ]}
      />

      <div className="space-y-6">
        <PokedexHero
          pokemon={pokemon}
          species={species}
          genus={genus}
          flavorText={flavorText}
        />

        <PokedexStats stats={pokemon.stats} />

        {evolutionChain && (
          <PokedexEvolutionChain chain={evolutionChain.chain} />
        )}
      </div>

      {relatedCards.length > 0 ? (
        <CardCarousel
          title={t("allCardsOf", { name: displayName, count: relatedCards.length })}
          items={relatedCards}
        />
      ) : (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="mb-3 text-lg font-bold text-foreground">
            {t("allCardsOfEmpty", { name: displayName })}
          </h2>
          <p className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {t("noCardsYet")}
          </p>
        </section>
      )}
    </div>
  );
}
