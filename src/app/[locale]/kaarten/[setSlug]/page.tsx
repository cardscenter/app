import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SetCardsGrid } from "@/components/card/set-cards-grid";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { hasReverseHoloSignal } from "@/lib/buyback-pricing";
import { Layers } from "lucide-react";

export const revalidate = 3600;

interface Props {
  params: Promise<{ setSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { setSlug } = await params;
  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId: setSlug },
    select: { name: true, cardCount: true, series: { select: { name: true } } },
  });
  if (!set) return { title: "Set niet gevonden — Cards Center" };
  return {
    title: `${set.name} — Pokémon kaarten — Cards Center`,
    description: `Bekijk alle ${set.cardCount ?? ""} kaarten uit ${set.name} (${set.series.name}). Vergelijk prijzen en zie wat er nu te koop is.`,
  };
}

export default async function SetDetailPage({ params }: Props) {
  const { setSlug } = await params;

  const set = await prisma.cardSet.findUnique({
    where: { tcgdexSetId: setSlug },
    include: {
      series: { select: { name: true } },
      cards: {
        select: {
          id: true,
          name: true,
          localId: true,
          rarity: true,
          imageUrl: true,
          imageUrlFull: true,
          variants: true,
          gameplayJson: true,
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
        },
      },
    },
  });

  if (!set) notFound();

  // Ascended Heroes (me02.5): Pokemon + Energy commons/uncommons hebben beide
  // Ball + Energy Reverse Holo finishes. Trainers gewoon standaard Reverse Holo.
  function reverseLabelFor(c: { gameplayJson: string | null }): string {
    if (set!.tcgdexSetId !== "me02.5") return "Reverse";
    try {
      const cat = (JSON.parse(c.gameplayJson || "{}") as { category?: string }).category;
      if (cat === "Pokemon" || cat === "Energy") return "Ball/Energy Reverse";
    } catch { /* ignore */ }
    return "Reverse";
  }

  // Pre-compute outlier-resistant Marktprijs server-side per card.
  // De grid hoeft dan geen pricing-logic te kennen.
  const cardsForGrid = set.cards.map((c) => ({
    id: c.id,
    name: c.name,
    localId: c.localId,
    rarity: c.rarity,
    imageUrl: c.imageUrl,
    imageUrlFull: c.imageUrlFull,
    variants: c.variants,
    marktprijs: getMarktprijs(c),
    // Alleen RH-prijs tonen als er een echt reverse-holo printing bestaat
    // (blokkeert pokewallet-lekkage op sets als Detective Pikachu).
    marktprijsRH: hasReverseHoloSignal({ ...c, releaseDate: set.releaseDate })
      ? getMarktprijsReverseHolo(c)
      : null,
    rhLabel: reverseLabelFor(c),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Kaarten", href: "/kaarten" },
          { label: set.name },
        ]}
      />

      <header className="mb-8 mt-2 flex items-start gap-5">
        {set.logoUrl ? (
          <div className="flex h-24 items-center rounded-2xl bg-muted/40 px-5">
            <Image
              src={set.logoUrl}
              alt={set.name}
              width={200}
              height={80}
              className="max-h-16 w-auto object-contain"
              unoptimized
            />
          </div>
        ) : null}
        <div>
          <p className="text-sm text-muted-foreground">{set.series.name}</p>
          <h1 className="text-3xl font-bold text-foreground">{set.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {set.cards.length} kaarten
            {set.releaseDate && ` · uitgegeven ${new Date(set.releaseDate).toLocaleDateString("nl-NL")}`}
          </p>
        </div>
      </header>

      {set.cards.length === 0 ? (
        <div className="glass-subtle rounded-2xl p-12 text-center text-muted-foreground">
          <Layers className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          Nog geen kaarten geïmporteerd voor deze set.
        </div>
      ) : (
        <SetCardsGrid cards={cardsForGrid} setSlug={setSlug} />
      )}
    </div>
  );
}
