/**
 * One-off: set priceOverrideAvg on McDonald's Collection 2024 (2024sv) cards
 * using the user-sourced USD Ungraded prices from TCGCollector, converted
 * to EUR at 0.92. These cards aren't catalogued yet on CardMarket /
 * pokemontcg.io / PriceCharting base URL, so an explicit override is the
 * only source of truth until upstream catches up.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const USD_TO_EUR = 0.92;

const PRICES_USD: Array<{ localId: string; name: string; usd: number }> = [
  { localId: "1",  name: "Charizard",    usd: 1.78 },
  { localId: "2",  name: "Pikachu",      usd: 3.46 },
  { localId: "3",  name: "Miraidon",     usd: 0.52 },
  { localId: "4",  name: "Jigglypuff",   usd: 0.18 },
  { localId: "5",  name: "Hatenna",      usd: 0.12 },
  { localId: "6",  name: "Dragapult",    usd: 0.19 },
  { localId: "7",  name: "Quagsire",     usd: 0.19 },
  { localId: "8",  name: "Koraidon",     usd: 0.36 },
  { localId: "9",  name: "Umbreon",      usd: 1.06 },
  { localId: "10", name: "Hydreigon",    usd: 0.59 },
  { localId: "11", name: "Roaring Moon", usd: 0.45 },
  { localId: "12", name: "Dragonite",    usd: 5.02 },
  { localId: "13", name: "Eevee",        usd: 0.30 },
  { localId: "14", name: "Rayquaza",     usd: 0.58 },
  { localId: "15", name: "Drampa",       usd: 0.82 },
];

async function main() {
  const set = await prisma.cardSet.findUnique({ where: { tcgdexSetId: "2024sv" } });
  if (!set) {
    console.error("2024sv set not found in DB");
    return;
  }

  for (const p of PRICES_USD) {
    const eur = Math.round(p.usd * USD_TO_EUR * 100) / 100;
    const id = `2024sv-${p.localId}`;
    const result = await prisma.card.update({
      where: { id },
      data: {
        priceOverrideAvg: eur,
        priceOverrideReason: `TCGCollector Ungraded USD $${p.usd.toFixed(2)} (manual override, upstream DBs don't have this set yet)`,
        // Also set the displayed fields so the UI shows the correct price
        // immediately — enrichCard will overwrite these from the override
        // on its next run, so storing them directly keeps the two in sync.
        priceAvg: eur,
        priceLow: eur,
        priceTrend: eur,
        priceAvg7: eur,
        priceAvg30: eur,
        // Clear any stale reverse-holo data (no reverse variants in this set)
        priceReverseAvg: null,
        priceReverseLow: null,
        priceReverseTrend: null,
        priceReverseAvg7: null,
        priceReverseAvg30: null,
        priceUpdatedAt: new Date(),
      },
    });
    console.log(`  ✓ ${id} ${result.name.padEnd(14)} $${p.usd.toFixed(2)} → €${eur.toFixed(2)}`);
  }

  console.log(`\n✅ ${PRICES_USD.length} prijzen ingesteld voor ${set.name}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
