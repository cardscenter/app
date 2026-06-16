// Past de set-remappings toe op de DB (Turso). Dry-run by default; --apply schrijft.
// Detecteert unique-constraint-conflicten (doel-id al door andere set geclaimd)
// en ruimt lege shell-sets op die het doel-id bezet houden.
//
//   DATABASE_URL="libsql://...turso.io" npx tsx scripts/pw-apply-remap.ts          (dry-run)
//   DATABASE_URL="libsql://...turso.io" npx tsx scripts/pw-apply-remap.ts --apply   (schrijft)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// tcgdexSetId → nieuwe pokewalletSetId (zie MANUAL_SET_MAPPING in set-mapping.ts)
const REMAP: Record<string, string> = {
  sm7: "2278", sm6: "2209", xy9: "1701",
  sm8: "-113", sm9: "-173", sm10: "-185", sm11: "-186", sm12: "-16",
  bw1: "1400", ex1: "1393", ecard1: "1375", bwp: "1407", dpp: "1421",
  "2011bw": "1401", "2012bw": "1427", bog: "-8", fut2020: "-95", basep: "-192",
};

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "── APPLY MODE ──\n" : "── DRY-RUN (gebruik --apply om te schrijven) ──\n");

  for (const [tcgdex, newPw] of Object.entries(REMAP)) {
    const target = await prisma.cardSet.findFirst({
      where: { tcgdexSetId: tcgdex },
      select: { id: true, name: true, pokewalletSetId: true, _count: { select: { cards: true } } },
    });
    if (!target) { console.log(`✗ ${tcgdex.padEnd(8)} → ${newPw}: GEEN DB-set met deze tcgdexSetId`); continue; }
    if (target.pokewalletSetId === newPw) { console.log(`= ${tcgdex.padEnd(8)} → ${newPw}: al correct (${target.name})`); continue; }

    // Bezet een andere set dit doel-id?
    const holder = await prisma.cardSet.findFirst({
      where: { pokewalletSetId: newPw, NOT: { id: target.id } },
      select: { id: true, name: true, _count: { select: { cards: true } } },
    });

    let action = `${tcgdex.padEnd(8)} ${target.name.slice(0,28).padEnd(28)} (${target._count.cards} kaarten) ${target.pokewalletSetId ?? "GEEN"} → ${newPw}`;
    if (holder) {
      action += `  ⚠ doel bezet door "${holder.name}" (${holder._count.cards} kaarten)`;
      if (holder._count.cards === 0) {
        action += " [lege shell → mapping wissen]";
        if (apply) {
          await prisma.cardSet.update({ where: { id: holder.id }, data: { pokewalletSetId: null, pokewalletSetCode: null } });
        }
      } else {
        action += " [NIET-leeg → OVERGESLAGEN, handmatig nodig]";
        console.log("✗ " + action);
        continue;
      }
    }

    if (apply) {
      await prisma.cardSet.update({ where: { id: target.id }, data: { pokewalletSetId: newPw } });
      console.log("✓ " + action);
    } else {
      console.log("→ " + action);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
