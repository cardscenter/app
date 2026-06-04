// Directe prijs-sync van PokeWallet → Turso, zonder Railway tussen.
//
// Override DATABASE_URL op script-start, zodat src/lib/prisma.ts via de
// libsql-adapter direct met Turso praat. Daarna hergebruiken we de
// bestaande syncSetByPokewalletId uit src/lib/pokewallet/sync.ts — met
// alle jouw lokale prijs-regels intact:
//
//   - getMarktprijs / getMarktprijsReverseHolo (blended pricing)
//   - priceOverrideAvg / priceOverrideReverseAvg (handmatige overrides)
//   - mapPatternVariantPricing (Master Ball / Poke Ball patterns)
//   - isSealedProduct + isVariantPattern filters
//   - CardMarket EUR + TCGPlayer USD (3 varianten)
//   - CardPriceHistory snapshots
//   - Gallery sub-sets (TG / GG)
//
// Vereisten in .env: POKEWALLET_API_KEY + TURSO_AUTH_TOKEN.
// Gebruik: npx tsx scripts/pw-sync-prices-direct.ts

import "dotenv/config";

const TURSO_URL = "libsql://cardscenter-cardscenter.aws-eu-west-1.turso.io";

// CRUCIAAL: override DATABASE_URL vóórdat prisma.ts wordt geïmporteerd,
// zodat de PrismaLibSql-adapter naar Turso wijst i.p.v. dev.db.
process.env.DATABASE_URL = TURSO_URL;

async function main() {
  if (!process.env.POKEWALLET_API_KEY) {
    console.error("❌ POKEWALLET_API_KEY ontbreekt in .env");
    process.exit(1);
  }
  if (!process.env.TURSO_AUTH_TOKEN) {
    console.error("❌ TURSO_AUTH_TOKEN ontbreekt in .env");
    process.exit(1);
  }

  // Dynamic imports zodat de DATABASE_URL-override actief is voordat
  // prisma.ts wordt geëvalueerd.
  const { prisma } = await import("../src/lib/prisma");
  const { syncSetByPokewalletId } = await import("../src/lib/pokewallet/sync");

  console.log(`→ Doel: ${TURSO_URL}`);
  console.log("→ Bron: PokeWallet API (lokale credentials)");
  console.log("");

  const sets = await prisma.cardSet.findMany({
    where: {
      pokewalletSetId: { not: null },
      cards: { some: {} },
    },
    select: { id: true, name: true, _count: { select: { cards: true } } },
    orderBy: { name: "asc" },
  });

  console.log(`${sets.length} mapped CardSets met cards. Start sync…\n`);

  let totalUpdated = 0;
  let totalUnmatched = 0;
  let setsOk = 0;
  const failures: { name: string; error: string }[] = [];
  const start = Date.now();

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const idx = `[${String(i + 1).padStart(3)}/${sets.length}]`;
    try {
      const r = await syncSetByPokewalletId(set.id);
      totalUpdated += r.updated;
      totalUnmatched += r.unmatched;
      setsOk++;
      const fb = r.fallbackUsed ? " (fallback)" : "";
      console.log(
        `${idx} ${set.name}: matched=${r.matched}/${r.pokewalletReturned} unmatched=${r.unmatched}${fb}`,
      );
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      failures.push({ name: set.name, error: msg });
      console.log(`${idx} ${set.name}: ❌ ${msg}`);
    }
    // Anti-rate-limit pauze
    await new Promise((r) => setTimeout(r, 100));
  }

  const dur = Math.round((Date.now() - start) / 1000);
  console.log("");
  console.log("─".repeat(60));
  console.log(`✅ Klaar in ${Math.floor(dur / 60)}m${dur % 60}s`);
  console.log(`   Sets OK: ${setsOk}/${sets.length}`);
  console.log(`   Cards updated: ${totalUpdated}`);
  console.log(`   Cards unmatched: ${totalUnmatched} (niet in PokeWallet)`);
  if (failures.length > 0) {
    console.log(`   Failures: ${failures.length}`);
    for (const f of failures.slice(0, 10)) console.log(`     - ${f.name}: ${f.error}`);
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Sync faalde:", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
