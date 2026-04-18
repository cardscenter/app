import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Imports all Pokémon series + sets from TCGdex into the local Series + CardSet
// tables. Idempotent: re-running upserts existing rows without losing user-
// added data. Run via: `npx tsx prisma/seed-tcgdex-sets.ts`.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";

interface TCGdexSeriesBrief {
  id: string;
  name: string;
  logo?: string;
}

interface TCGdexSetInSeries {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  releaseDate?: string;
  cardCount: { official: number; total: number };
}

interface TCGdexSeriesFull extends TCGdexSeriesBrief {
  releaseDate?: string;
  sets: TCGdexSetInSeries[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${TCGDEX_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TCGdex ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function main() {
  console.log("🃏 Syncing TCGdex Pokémon series + sets...");

  // Find or create the Pokémon category — required by Series schema
  const category = await prisma.category.upsert({
    where: { slug: "pokemon" },
    create: { name: "Pokémon", slug: "pokemon" },
    update: {},
  });

  console.log(`📁 Category: ${category.name} (${category.id})`);

  // Fetch series list
  const seriesList = await fetchJson<TCGdexSeriesBrief[]>("/series");
  console.log(`🔎 Found ${seriesList.length} series in TCGdex`);

  let totalSets = 0;
  let createdSets = 0;
  let updatedSets = 0;

  // Series we never want (different product, not the TCG we track).
  const EXCLUDED_SERIES = new Set(["tcgp"]); // Pokémon TCG Pocket (mobile game)

  for (const seriesBrief of seriesList) {
    if (EXCLUDED_SERIES.has(seriesBrief.id)) continue;
    // Fetch series detail (includes sets array)
    const seriesFull = await fetchJson<TCGdexSeriesFull>(
      `/series/${encodeURIComponent(seriesBrief.id)}`
    );

    // Upsert series via tcgdexSeriesId. If a legacy series with the same name
    // exists but no tcgdexSeriesId yet, prefer to update by name first to
    // attach the TCGdex link, otherwise create new.
    let series = await prisma.series.findUnique({
      where: { tcgdexSeriesId: seriesFull.id },
    });

    if (!series) {
      const legacy = await prisma.series.findFirst({
        where: { name: seriesFull.name, categoryId: category.id, tcgdexSeriesId: null },
      });
      if (legacy) {
        series = await prisma.series.update({
          where: { id: legacy.id },
          data: {
            tcgdexSeriesId: seriesFull.id,
            logoUrl: seriesFull.logo ?? null,
          },
        });
      } else {
        series = await prisma.series.create({
          data: {
            name: seriesFull.name,
            tcgdexSeriesId: seriesFull.id,
            logoUrl: seriesFull.logo ?? null,
            categoryId: category.id,
          },
        });
      }
    } else {
      series = await prisma.series.update({
        where: { id: series.id },
        data: {
          name: seriesFull.name,
          logoUrl: seriesFull.logo ?? null,
        },
      });
    }

    // Upsert each set under this series
    for (const set of seriesFull.sets) {
      totalSets++;

      const existing = await prisma.cardSet.findUnique({
        where: { tcgdexSetId: set.id },
      });

      if (existing) {
        await prisma.cardSet.update({
          where: { id: existing.id },
          data: {
            name: set.name,
            logoUrl: set.logo ? `${set.logo}.webp` : null,
            symbolUrl: set.symbol ?? null,
            releaseDate: set.releaseDate ?? null,
            cardCount: set.cardCount.total ?? set.cardCount.official ?? null,
            seriesId: series.id,
          },
        });
        updatedSets++;
      } else {
        // Try to attach to a legacy CardSet by name within this series first
        const legacySet = await prisma.cardSet.findFirst({
          where: {
            name: set.name,
            seriesId: series.id,
            tcgdexSetId: null,
          },
        });
        if (legacySet) {
          await prisma.cardSet.update({
            where: { id: legacySet.id },
            data: {
              tcgdexSetId: set.id,
              logoUrl: set.logo ? `${set.logo}.webp` : null,
              symbolUrl: set.symbol ?? null,
              releaseDate: set.releaseDate ?? null,
              cardCount: set.cardCount.total ?? set.cardCount.official ?? null,
            },
          });
          updatedSets++;
        } else {
          await prisma.cardSet.create({
            data: {
              name: set.name,
              tcgdexSetId: set.id,
              logoUrl: set.logo ? `${set.logo}.webp` : null,
              symbolUrl: set.symbol ?? null,
              releaseDate: set.releaseDate ?? null,
              cardCount: set.cardCount.total ?? set.cardCount.official ?? null,
              seriesId: series.id,
            },
          });
          createdSets++;
        }
      }
    }

    console.log(`  ✓ ${seriesFull.name} — ${seriesFull.sets.length} sets`);
  }

  console.log(`\n✅ Sync complete: ${seriesList.length} series, ${totalSets} sets total (${createdSets} new, ${updatedSets} updated).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
