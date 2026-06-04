// Snel: forceer CardSet.pokewalletSetId van lokaal → Turso.
// Gebruikt UPDATE i.p.v. UPSERT zodat we Card-conflicts vermijden.

import "dotenv/config";
import { createClient } from "@libsql/client";
import { prisma } from "../src/lib/prisma";

const TURSO_URL = "libsql://cardscenter-cardscenter.aws-eu-west-1.turso.io";

async function main() {
  const client = createClient({ url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN! });

  const local = await prisma.cardSet.findMany({
    where: { pokewalletSetId: { not: null } },
    select: { id: true, pokewalletSetId: true, pokewalletSetCode: true, name: true },
  });
  console.log(`Lokaal ${local.length} CardSets met pokewalletSetId.`);

  // Eerst alle pokewalletSetId op Turso clearen om conflicten te vermijden
  // (twee DB-sets met zelfde pokewalletSetId = UNIQUE violation).
  console.log("Stap 1: clear bestaande pokewalletSetId op Turso…");
  await client.execute("UPDATE CardSet SET pokewalletSetId = NULL, pokewalletSetCode = NULL");

  console.log("Stap 2: zet correcte mappings…");
  let ok = 0;
  let fail = 0;
  for (const s of local) {
    try {
      await client.execute({
        sql: "UPDATE CardSet SET pokewalletSetId = ?, pokewalletSetCode = ? WHERE id = ?",
        args: [s.pokewalletSetId, s.pokewalletSetCode, s.id],
      });
      ok++;
    } catch (e) {
      console.error(`  Fail op ${s.name}: ${(e as Error).message.slice(0, 100)}`);
      fail++;
    }
  }
  console.log(`✓ ${ok} mappings gezet, ${fail} fail.`);

  const v = await client.execute("SELECT COUNT(*) AS n FROM CardSet WHERE pokewalletSetId IS NOT NULL");
  console.log(`Turso heeft nu ${v.rows[0].n} CardSets met pokewalletSetId.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
