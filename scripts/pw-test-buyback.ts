import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getServerMarketPrice } from "../src/lib/buyback-pricing-server";
import { getBuybackPrice, getStoreCreditBonus } from "../src/lib/buyback-pricing";

const TARGETS = [
  { name: "Squirtle", localId: "007", set: "sv03.5", note: "151 Common (was €160 corrupt)" },
  { name: "Bulbasaur", localId: "001", set: "sv03.5", note: "151 Common" },
  { name: "Pikachu", localId: "025", set: "sv03.5", note: "151 Common (RH primary)" },
  { name: "Klink", localId: "139", set: "sv10.5b", note: "BB IR (was bug €14.31)" },
  { name: "Pawniard", localId: "142", set: "sv10.5b", note: "BB IR spike" },
  { name: "Chien-Pao ex", localId: "061", set: "sv02", note: "PAL DR" },
];

(async () => {
  for (const t of TARGETS) {
    const card = await prisma.card.findFirst({
      where: { name: t.name, localId: t.localId, cardSet: { tcgdexSetId: t.set } },
      select: { id: true, name: true, rarity: true },
    });
    if (!card) {
      console.log(`✗ ${t.name} #${t.localId} (${t.set}) not found`);
      continue;
    }
    const normal = await getServerMarketPrice(card.id, false);
    const reverse = await getServerMarketPrice(card.id, true);
    const buyN = normal ? getBuybackPrice(normal.price) : null;
    const buyR = reverse ? getBuybackPrice(reverse.price) : null;
    const bonusN = buyN ? getStoreCreditBonus(buyN) : null;

    console.log(`\n${t.name} #${t.localId} (${card.rarity}) — ${t.note}`);
    console.log(`  Normal:  Marktprijs €${normal?.price ?? "—"} → Inkoop €${buyN ?? "—"}  (+5% bonus = +€${bonusN ?? "—"})`);
    console.log(`  Reverse: Marktprijs €${reverse?.price ?? "—"} → Inkoop €${buyR ?? "—"}`);
  }
  await prisma.$disconnect();
})();
