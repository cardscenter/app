// Inspecteer pokewallet response voor Ascended Heroes / Black Bolt om te zien
// hoe Master Ball / Poke Ball / Energy / Ball Reverse Holo varianten verschijnen.
import "dotenv/config";
import { fetchAllPagesForSet, fetchSetViaCardLookup } from "../src/lib/pokewallet/client";

const SETS = [
  { id: "24541", name: "Ascended Heroes" },
  { id: "24325", name: "Black Bolt" },
  { id: "23821", name: "Prismatic Evolutions" },
];

(async () => {
  for (const s of SETS) {
    console.log(`\n=== ${s.name} (${s.id}) ===`);
    let cards = await fetchAllPagesForSet(s.id);
    if (cards.length === 0) {
      console.log("(via /search empty, trying /sets fallback)");
      cards = await fetchSetViaCardLookup(s.id);
    }
    console.log(`Total cards: ${cards.length}`);

    // Groepeer per card_number, zoek varianten
    const byNum = new Map<string, typeof cards>();
    for (const c of cards) {
      const num = c.card_info.card_number?.split("/")[0]?.trim() ?? "";
      if (!byNum.has(num)) byNum.set(num, []);
      byNum.get(num)!.push(c);
    }

    // Print kaarten met >1 variant op zelfde nummer
    let dups = 0;
    for (const [num, list] of byNum) {
      if (list.length > 1) {
        dups++;
        if (dups <= 10) {
          console.log(`\n  Card #${num}:`);
          for (const c of list) {
            const cmAvg = c.cardmarket?.prices?.find(p => p.variant_type === "normal")?.avg ?? c.cardmarket?.prices?.[0]?.avg;
            const cmHolo = c.cardmarket?.prices?.find(p => p.variant_type === "holo")?.avg;
            console.log(`    "${c.card_info.name}" → CM normal=${cmAvg} holo=${cmHolo}  pk=${c.id.slice(0,16)}`);
          }
        }
      }
    }
    console.log(`\n  Total cards met >1 variant: ${dups}`);
  }
})();
