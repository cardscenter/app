// Bulk-backfill: mirror kaart- en set-afbeeldingen van PokeWallet naar R2/schijf.
//
// Weerbaarheid tegen TCGdex-storingen — vult Card.imageMirrorKey /
// CardSet.logoMirrorKey en zet de bytes in onze eigen opslag. Idempotent
// (skipt al-gemirrorde), resumable (cursor op Card.id) en gepaced (respecteert
// de PokeWallet-limiet van 5000 calls/uur; fetchBinary handelt 429 zelf af).
//
// Lokaal (geen R2-env-vars) schrijft 'ie naar public/uploads/ op schijf.
// Voor productie: DATABASE_URL=libsql://… + R2_*-env-vars meegeven.
//
// Gebruik:
//   npx tsx scripts/pw-mirror-images.ts                       # alles (cards + logos)
//   npx tsx scripts/pw-mirror-images.ts --only=cards --limit=20
//   npx tsx scripts/pw-mirror-images.ts --only=logos
//   npx tsx scripts/pw-mirror-images.ts --cursor=base1-9 --concurrency=2 --sleep=2500
//
// Vlaggen:
//   --only=cards|logos|both   (default both)
//   --limit=N                 max kaarten deze run (0 = alle; default 0)
//   --cursor=<Card.id>        hervat vanaf id > cursor (default begin)
//   --concurrency=N           parallelle items per batch (default 3)
//   --sleep=MS                pauze tussen batches (default 1500)
//   --chunk=N                 DB-page grootte (default 500)

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { isR2Configured } from "../src/lib/r2";
import {
  mirrorCardImage,
  mirrorSetLogo,
  mapPaced,
} from "../src/lib/pokewallet/mirror-images";

function arg(name: string, def: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

async function main() {
  const only = arg("only", "both"); // cards | logos | both
  const limit = parseInt(arg("limit", "0"), 10) || 0; // 0 = alle
  const startCursor = arg("cursor", "");
  const concurrency = Math.max(1, parseInt(arg("concurrency", "3"), 10) || 3);
  const sleepMs = Math.max(0, parseInt(arg("sleep", "1500"), 10));
  const chunk = Math.max(1, parseInt(arg("chunk", "500"), 10) || 500);

  console.log(
    `Doel: ${isR2Configured() ? "R2 (productie-opslag)" : "lokale schijf (public/uploads)"}`,
  );
  console.log(
    `only=${only} limit=${limit || "∞"} cursor=${startCursor || "(begin)"} ` +
      `concurrency=${concurrency} sleep=${sleepMs}ms chunk=${chunk}\n`,
  );

  const startedAt = Date.now();
  let mirroredCards = 0;
  let failedCards = 0;
  let mirroredLogos = 0;

  if (only === "cards" || only === "both") {
    // Totaal te doen (voor voortgangs-indicatie).
    const todo = await prisma.card.count({
      where: { pokewalletId: { not: null }, imageMirrorKey: null },
    });
    console.log(`Kaarten zonder mirror: ${todo}\n`);

    // Cursor op Card.id gaat ALTIJD vooruit — ook over kaarten die geen beeld
    // opleverden (imageMirrorKey blijft null) — zodat we niet vastlopen op
    // dezelfde falers binnen één run. Een verse run (zonder --cursor) probeert
    // falers opnieuw (staan nog op null).
    let lastId = startCursor;
    let processed = 0;
    while (true) {
      if (limit && processed >= limit) break;
      const take = limit ? Math.min(chunk, limit - processed) : chunk;
      const cards = await prisma.card.findMany({
        where: {
          pokewalletId: { not: null },
          imageMirrorKey: null,
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true, pokewalletId: true },
        orderBy: { id: "asc" },
        take,
      });
      if (cards.length === 0) break;

      await mapPaced(
        cards,
        async (c) => {
          const stem = await mirrorCardImage(c);
          if (stem) {
            await prisma.card.update({
              where: { id: c.id },
              data: { imageMirrorKey: stem },
            });
            mirroredCards++;
          } else {
            failedCards++;
          }
        },
        { concurrency, sleepMs },
      );

      lastId = cards[cards.length - 1].id;
      processed += cards.length;
      const mins = (Date.now() - startedAt) / 60000;
      const rate = mins > 0 ? Math.round(mirroredCards / mins) : 0;
      console.log(
        `  … ${mirroredCards} gemirrord · ${failedCards} zonder beeld · ` +
          `~${rate}/min · laatste id=${lastId}`,
      );
    }
  }

  if (only === "logos" || only === "both") {
    const sets = await prisma.cardSet.findMany({
      where: { pokewalletSetId: { not: null }, logoMirrorKey: null },
      select: { id: true, pokewalletSetId: true },
    });
    console.log(`\nSet-logo's zonder mirror: ${sets.length}`);
    await mapPaced(
      sets,
      async (s) => {
        const stem = await mirrorSetLogo(s);
        if (stem) {
          await prisma.cardSet.update({
            where: { id: s.id },
            data: { logoMirrorKey: stem },
          });
          mirroredLogos++;
        }
      },
      { concurrency, sleepMs },
    );
    console.log(`  … ${mirroredLogos}/${sets.length} logo's gemirrord`);
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nKlaar in ${mins} min: ${mirroredCards} kaarten + ${mirroredLogos} logo's gemirrord, ` +
      `${failedCards} kaarten zonder beeld.`,
  );
  if (failedCards) {
    console.log(
      "(kaarten zonder beeld houden imageMirrorKey=null → blijven op TCGdex-fallback; " +
        "een verse run zonder --cursor probeert ze opnieuw)",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
