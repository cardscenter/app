import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { cardSlug } from "@/lib/card-helpers";
import { getSiteUrl } from "@/lib/site-url";
import { isFeatureEnabled } from "@/lib/feature-flags";

// Public sitemap covering the card-database (Fase 4) so search engines can
// index every Pokémon card page. Marketplace listings/auctions are NOT
// included — they're transient. Keep this fast: only DB queries, no TCGdex
// calls.
//
// Base URL falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL in prod.

// Per-request genereren i.p.v. tijdens de build: tijdens `next build` is de
// (Turso-)database niet bereikbaar, dus build-time prerender zou falen. Bij
// een request draait de app mét database.
export const dynamic = "force-dynamic";

const BASE_URL = getSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/nl`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/nl/kaarten`, changeFrequency: "weekly", priority: 0.9 },
    // Handel alleen zolang de feature-flags aan staan (Community Hub, Fase 1).
    ...(isFeatureEnabled("FEATURE_MARKETPLACE")
      ? [{ url: `${BASE_URL}/nl/marktplaats`, changeFrequency: "hourly" as const, priority: 0.8 }]
      : []),
    ...(isFeatureEnabled("FEATURE_AUCTIONS")
      ? [{ url: `${BASE_URL}/nl/veilingen`, changeFrequency: "hourly" as const, priority: 0.8 }]
      : []),
    ...(isFeatureEnabled("FEATURE_CLAIMSALES")
      ? [{ url: `${BASE_URL}/nl/claimsales`, changeFrequency: "hourly" as const, priority: 0.8 }]
      : []),
    { url: `${BASE_URL}/nl/evenementen`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/nl/league`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/nl/nieuws`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/nl/ervaringen`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/nl/info`, changeFrequency: "monthly", priority: 0.6 },
    // Inkoopservice — de calculators zelf zijn login-gated en staan er niet in.
    { url: `${BASE_URL}/nl/verkopen`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/nl/verkopen/verpakken`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/nl/verkopen/voorwaarden-bulk`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/nl/verkopen/voorwaarden-losse-kaarten`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
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
  } catch {
    // Database (tijdelijk) niet bereikbaar → geef in elk geval de statische
    // pagina's terug zodat de sitemap nooit een 500 of build-fout veroorzaakt.
    return staticEntries;
  }
}
