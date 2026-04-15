import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// One-shot backfill: populate `CardSet.releaseDate` for every set that has a
// `tcgdexSetId`. The original set-seed used the series-endpoint which doesn't
// include per-set releaseDate; this script hits /v2/en/sets/{id} which does.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const BASE = "https://api.tcgdex.net/v2/en";
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { not: null } },
    select: { id: true, tcgdexSetId: true, name: true, releaseDate: true },
  });
  console.log(`🔎 ${sets.length} sets with tcgdexSetId, backfilling releaseDate...`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const s of sets) {
    if (s.releaseDate) { skipped++; continue; }
    try {
      const res = await fetch(`${BASE}/sets/${encodeURIComponent(s.tcgdexSetId!)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) { failed++; console.warn(`  ! ${s.tcgdexSetId}: ${res.status}`); continue; }
      const data = await res.json() as { releaseDate?: string };
      if (data.releaseDate) {
        await prisma.cardSet.update({
          where: { id: s.id },
          data: { releaseDate: data.releaseDate },
        });
        updated++;
        if (updated % 20 === 0) console.log(`  ✓ ${updated} updated…`);
      }
    } catch (e) {
      failed++;
      console.warn(`  ! ${s.tcgdexSetId}:`, e);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done: ${updated} updated, ${skipped} already had dates, ${failed} failed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
