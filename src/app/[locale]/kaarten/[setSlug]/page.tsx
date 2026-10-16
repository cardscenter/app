import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { SetCardsGrid } from "@/components/card/set-cards-grid";
import { getMarktprijs, getMarktprijsReverseHolo } from "@/lib/display-price";
import { getSetLogoUrl } from "@/lib/card-image";
import { hasReverseHoloSignal } from "@/lib/buyback-pricing";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { DisplayHeading } from "@/components/ploy/display-heading";
import { Pill } from "@/components/ploy/pill";
import { PunchCard } from "@/components/ploy/punch-card";

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

/** Set-pagina (design-pass Fase E): logo op een pastelvlak, naam in de display-letter, pillen, grid. */
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
          imageMirrorKey: true,
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
    } catch {
      /* ignore */
    }
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
    imageMirrorKey: c.imageMirrorKey,
    variants: c.variants,
    marktprijs: getMarktprijs(c),
    // Alleen RH-prijs tonen als er een echt reverse-holo printing bestaat
    // (blokkeert pokewallet-lekkage op sets als Detective Pikachu).
    marktprijsRH: hasReverseHoloSignal({ ...c, releaseDate: set.releaseDate }) ? getMarktprijsReverseHolo(c) : null,
    rhLabel: reverseLabelFor(c),
  }));
  const logo = getSetLogoUrl(set);

  return (
    <div className="cc-landing overflow-clip">
      <ScrollToTop />
      <section className="flex justify-center px-4 pb-10 pt-4 sm:px-5 lg:px-6 lg:pt-8">
        <div className="w-full max-w-6xl">
          <Link href="/kaarten" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]/55 no-underline transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft className="size-4" /> Alle sets
          </Link>
          <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-[20px] p-6 sm:h-40 sm:w-64" style={{ background: "var(--pastel-yellow)" }}>
              {logo ? <Image src={logo} alt={set.name} width={220} height={100} className="max-h-full w-auto object-contain" unoptimized /> : <Layers className="size-10 text-[var(--foreground)]/40" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="white">{set.series.name}</Pill>
                <Pill tone="pastel" color="blue">{set.cards.length} kaarten</Pill>
                {set.releaseDate && <Pill tone="pastel" color="green">{new Date(set.releaseDate).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}</Pill>}
              </div>
              <DisplayHeading tag="h1" size={3} text={set.name} className="mt-4" />
            </div>
          </header>
        </div>
      </section>

      <section className="flex justify-center px-4 pb-16 sm:px-5 lg:px-6 lg:pb-24">
        <div className="w-full max-w-6xl">
          {set.cards.length === 0 ? (
            <PunchCard className="bg-white p-12 text-center text-[var(--foreground)]/60" dot="var(--border)">
              <Layers className="mx-auto mb-3 size-8 text-[var(--foreground)]/30" />
              Nog geen kaarten geïmporteerd voor deze set.
            </PunchCard>
          ) : (
            <SetCardsGrid cards={cardsForGrid} setSlug={setSlug} />
          )}
        </div>
      </section>
    </div>
  );
}
