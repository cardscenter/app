import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// One-shot cleanup + logo backfill:
//   1. Delete Trainer Kit sets (tcgdexSetId LIKE "tk-%"),
//      "Yellow A Alternate" and "Poké Card Creator Pack" — and all their cards.
//      Clears `cardSetId` references on Listing/Auction/ClaimsaleItem first.
//   2. Normalize existing `CardSet.logoUrl` so they always end with `.webp`
//      (TCGdex convention). This is needed because we're about to mix in
//      pokemontcg.io URLs which already carry their own extension.
//   3. Backfill `logoUrl` from pokemontcg.io for any set TCGdex didn't supply
//      a logo for (mostly promos, McDonald's sets, Shining Legends etc).

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function step1Delete() {
  console.log("=== Step 1: delete unwanted sets ===");
  const setsToDelete = await prisma.cardSet.findMany({
    where: {
      OR: [
        { tcgdexSetId: { startsWith: "tk-" } },
        { name: "Yellow A Alternate" },
        { name: "Poké Card Creator Pack" },
      ],
    },
    select: { id: true, name: true, tcgdexSetId: true },
  });
  if (setsToDelete.length === 0) {
    console.log("  (no sets matched — already cleaned up)");
    return;
  }
  const ids = setsToDelete.map((s) => s.id);
  console.log(`  deleting ${setsToDelete.length} sets:`);
  for (const s of setsToDelete) console.log(`    - ${s.tcgdexSetId}  ${s.name}`);

  await prisma.$transaction([
    // Null out optional FK references so the final delete can succeed
    prisma.listing.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    prisma.auction.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    prisma.claimsaleItem.updateMany({ where: { cardSetId: { in: ids } }, data: { cardSetId: null } }),
    // Card delete cascades to CardWatchlist
    prisma.card.deleteMany({ where: { cardSetId: { in: ids } } }),
    prisma.cardSet.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`  ✓ deleted.`);
}

async function step2NormalizeLogos() {
  console.log("\n=== Step 2: normalize existing TCGdex logoUrls ===");
  const sets = await prisma.cardSet.findMany({
    where: {
      logoUrl: { not: null },
    },
    select: { id: true, logoUrl: true },
  });
  let updated = 0;
  for (const s of sets) {
    if (!s.logoUrl) continue;
    if (s.logoUrl.endsWith(".webp") || s.logoUrl.endsWith(".png") || s.logoUrl.endsWith(".jpg")) continue;
    if (!s.logoUrl.startsWith("https://assets.tcgdex.net")) continue;
    await prisma.cardSet.update({
      where: { id: s.id },
      data: { logoUrl: `${s.logoUrl}.webp` },
    });
    updated++;
  }
  console.log(`  normalized ${updated} TCGdex logoUrls (appended .webp).`);
}

interface PtcgSetBrief { id: string; name: string }
interface PtcgSetFull {
  id: string;
  name: string;
  images: { logo?: string; symbol?: string };
}

async function step3BackfillLogos() {
  console.log("\n=== Step 3: backfill missing logos from pokemontcg.io ===");

  // Pull ptcgio set catalog once
  const res = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=250");
  const { data: ptcgSets } = await res.json() as { data: PtcgSetBrief[] };
  const byName = new Map<string, PtcgSetBrief>();
  for (const s of ptcgSets) byName.set(norm(s.name), s);

  const missing = await prisma.cardSet.findMany({
    where: {
      OR: [{ logoUrl: null }, { logoUrl: "" }],
      cards: { some: {} },
      NOT: { series: { tcgdexSeriesId: "tcgp" } },
    },
    select: { id: true, name: true, tcgdexSetId: true },
  });
  console.log(`  ${missing.length} active sets missing a logo.`);

  let found = 0;
  for (const s of missing) {
    const match = byName.get(norm(s.name));
    if (!match) {
      console.log(`    ✗ ${s.name}  (no ptcgio match)`);
      continue;
    }
    try {
      const detailRes = await fetch(`https://api.pokemontcg.io/v2/sets/${match.id}`);
      if (!detailRes.ok) continue;
      const { data } = await detailRes.json() as { data: PtcgSetFull };
      const logo = data.images?.logo;
      if (logo) {
        await prisma.cardSet.update({
          where: { id: s.id },
          data: { logoUrl: logo },
        });
        console.log(`    ✓ ${s.name}  →  ${logo}`);
        found++;
      }
    } catch (e) {
      console.warn(`    ! ${s.name}:`, e);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\n  ✓ backfilled ${found}/${missing.length} logos.`);
}

async function main() {
  await step1Delete();
  await step2NormalizeLogos();
  await step3BackfillLogos();
  console.log("\n✅ Cleanup complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
