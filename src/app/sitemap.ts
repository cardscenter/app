import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { cardSlug } from "@/lib/tcgdex/slug";

// Public sitemap covering the card-database (Fase 4) so search engines can
// index every Pokémon card page. Marketplace listings/auctions are NOT
// included — they're transient. Keep this fast: only DB queries, no TCGdex
// calls.
//
// Base URL falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL in prod.

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sets, cards] = await Promise.all([
    prisma.cardSet.findMany({
      where: { tcgdexSetId: { not: null }, cards: { some: {} } },
      select: { tcgdexSetId: true, releaseDate: true },
    }),
    prisma.card.findMany({
      select: {
        name: true,
        localId: true,
        updatedAt: true,
        cardSet: { select: { tcgdexSetId: true } },
      },
    }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/nl`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/nl/kaarten`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/nl/marktplaats`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/nl/veilingen`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/nl/claimsales`, changeFrequency: "hourly", priority: 0.8 },
  ];

  const setEntries: MetadataRoute.Sitemap = sets
    .filter((s) => s.tcgdexSetId)
    .map((s) => ({
      url: `${BASE_URL}/nl/kaarten/${s.tcgdexSetId}`,
      lastModified: s.releaseDate ? new Date(s.releaseDate) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const cardEntries: MetadataRoute.Sitemap = cards
    .filter((c) => c.cardSet.tcgdexSetId)
    .map((c) => ({
      url: `${BASE_URL}/nl/kaarten/${c.cardSet.tcgdexSetId}/${cardSlug(c.name, c.localId)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...staticEntries, ...setEntries, ...cardEntries];
}
