import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Backfill CardSet.cardCount to use `total` (all printed variants including
// secret rares + alt-arts) instead of `official` (numbered main-set only).
// Collectors think in "total" terms.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 300;
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (attempt < MAX_RETRIES) await sleep(500 * attempt);
    } catch {
      if (attempt < MAX_RETRIES) await sleep(500 * attempt);
    }
  }
  return null;
}

async function main() {
  const sets = await prisma.cardSet.findMany({
    where: { tcgdexSetId: { not: null } },
    select: { id: true, tcgdexSetId: true, name: true, cardCount: true },
  });
  console.log(`🔎 ${sets.length} sets — refreshing cardCount from TCGdex /sets/{id}…\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const s of sets) {
    try {
      const res = await fetchWithRetry(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(s.tcgdexSetId!)}`);
      if (!res) { failed++; continue; }
      const data = await res.json() as { cardCount?: { official?: number; total?: number } };
      const total = data.cardCount?.total ?? data.cardCount?.official ?? null;
      if (total !== null && total !== s.cardCount) {
        await prisma.cardSet.update({ where: { id: s.id }, data: { cardCount: total } });
        updated++;
      } else {
        unchanged++;
      }
    } catch { failed++; }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ ${updated} updated, ${unchanged} unchanged, ${failed} failed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
