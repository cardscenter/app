import "dotenv/config";
import { prisma } from "../src/lib/prisma";

(async () => {
  const cards = await prisma.card.findMany({
    where: { cardSet: { tcgdexSetId: "me02.5" } },
    select: { name: true, localId: true, rarity: true, hp: true, gameplayJson: true, priceReverseAvg: true },
    orderBy: { localId: "asc" },
  });
  console.log(`AH: ${cards.length} cards`);
  // Sample diverse cards
  const samples = [
    cards.find(c => c.localId === "001"),
    cards.find(c => c.localId === "181"),  // Air Balloon (item)
    cards.find(c => c.localId === "191"),  // Light Ball
    cards.find(c => c.localId === "216"),  // Prism Energy
    cards.find(c => c.localId === "217"),  // Team Rocket's Energy
  ].filter(Boolean);
  for (const c of samples) {
    let cat = "?";
    try { cat = (JSON.parse(c!.gameplayJson || "{}") || {}).category ?? "?"; } catch {}
    console.log(`#${c!.localId.padEnd(4)} hp=${(c!.hp ?? "—").toString().padEnd(4)} rarity='${c!.rarity}' category='${cat}' RHavg=${c!.priceReverseAvg ?? "—"}  name='${c!.name}'`);
  }
  await prisma.$disconnect();
})();
