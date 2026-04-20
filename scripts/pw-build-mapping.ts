// One-time: build CardSet → PokeWallet set_id mapping in DB.
// Run with: npx tsx scripts/pw-build-mapping.ts

import "dotenv/config";
import { refreshSetMapping } from "../src/lib/pokewallet/set-mapping";

async function main() {
  console.log("Fetching /sets from PokeWallet…");
  const result = await refreshSetMapping();
  console.log(`\nMapping result: ${result.matched}/${result.total} matched`);

  if (result.duplicates.length > 0) {
    console.log(`\nDuplicates skipped (${result.duplicates.length}) — multiple DB sets matched same pokewalletId:`);
    for (const d of result.duplicates) {
      console.log(`  ${d.id}  name="${d.name}"  wanted pokewalletId=${d.pokewalletId}`);
    }
  }

  if (result.unmatched.length > 0) {
    console.log(`\nUnmatched (${result.unmatched.length}):`);
    for (const u of result.unmatched) {
      console.log(`  ${u.id}  tcgdex=${u.tcgdexSetId ?? "?"}  name="${u.name}"`);
    }
    console.log("\nReview these — add to MANUAL_SET_MAPPING in src/lib/pokewallet/set-mapping.ts");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
