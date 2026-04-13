import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cardSlug } from "@/lib/tcgdex/slug";
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
        orderBy: { localId: "asc" },
        select: {
          id: true,
          name: true,
          localId: true,
          rarity: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!set) notFound();

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
              src={`${set.logoUrl}.webp`}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {set.cards.map((card) => (
            <Link
              key={card.id}
              href={`/kaarten/${setSlug}/${cardSlug(card.name, card.localId)}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="relative aspect-[5/7] bg-muted">
                {card.imageUrl ? (
                  <Image
                    src={`${card.imageUrl}/low.webp`}
                    alt={card.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground/50">
                    Geen afbeelding
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-semibold text-foreground">{card.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  #{card.localId}
                  {card.rarity && ` · ${card.rarity}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
