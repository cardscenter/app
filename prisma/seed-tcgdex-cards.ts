import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Bulk-imports all Pokémon cards from TCGdex into the local Card table.
// Iterates over every CardSet that has a `tcgdexSetId` (synced via
// seed-tcgdex-sets.ts) and pulls /v2/en/sets/{tcgdexSetId} which returns
// the set + its `cards` array.
//
// Idempotent: re-running upserts existing rows. Pricing is NOT fetched here
// (would be 16k extra requests); the price-sync cron handles that.
//
// Usage: `npx tsx prisma/seed-tcgdex-cards.ts`

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";
const REQUEST_DELAY_MS = 100; // gentle pacing

interface TCGdexCardInSet {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface TCGdexCardFull extends TCGdexCardInSet {
  rarity?: string;
  hp?: number;
  types?: string[];
  illustrator?: string;
  variants?: Record<string, boolean>;
}

interface TCGdexSetFull {
  id: string;
  name: string;
  cards: TCGdexCardInSet[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${TCGDEX_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TCGdex ${res.status} on ${path}`);
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🃏 Importing Pokémon cards from TCGdex...");
  console.log("   (use seed-tcgdex-sets.ts first to sync sets)\n");

  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { not: null } },
    select: { id: true, name: true, tcgdexSetId: true, cardCount: true },
    orderBy: { releaseDate: "asc" },
  });

  console.log(`📚 Found ${sets.length} sets to import.\n`);

  let totalCards = 0;
  let createdCards = 0;
  let updatedCards = 0;
  let setsDone = 0;

  for (const localSet of sets) {
    if (!localSet.tcgdexSetId) continue;
    setsDone++;

    try {
      const tcgSet = await fetchJson<TCGdexSetFull>(
        `/sets/${encodeURIComponent(localSet.tcgdexSetId)}`
      );

      // Note: the set endpoint returns brief card data only (no rarity/hp/etc).
      // Full per-card metadata is intentionally NOT fetched here — it would
      // be 16k requests. Detail is enriched lazily on first card-page view
      // or by the price-sync cron.
      const tx = await prisma.$transaction(
        tcgSet.cards.map((card) =>
          prisma.card.upsert({
            where: { id: card.id },
            create: {
              id: card.id,
              localId: card.localId,
              name: card.name,
              cardSetId: localSet.id,
              imageUrl: card.image ?? null,
            },
            update: {
              localId: card.localId,
              name: card.name,
              cardSetId: localSet.id,
              imageUrl: card.image ?? null,
            },
          })
        )
      );

      totalCards += tcgSet.cards.length;
      // Prisma upsert doesn't tell us if it created or updated, so just count
      // the total. createdCards/updatedCards are approximations.
      createdCards += tx.length;

      const progress = `[${setsDone}/${sets.length}]`;
      console.log(`  ${progress} ✓ ${tcgSet.name}: ${tcgSet.cards.length} cards`);

      await sleep(REQUEST_DELAY_MS);
    } catch (e) {
      console.error(`  ✗ ${localSet.name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n✅ Import complete: ${totalCards} cards across ${setsDone} sets.`);
  console.log("   Run the price-sync cron to populate Cardmarket pricing.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
