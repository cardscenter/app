import "dotenv/config";
import { fetchSetViaCardLookup } from "../src/lib/pokewallet/client";

(async () => {
  const cards = await fetchSetViaCardLookup("24541");
  console.log(`Total: ${cards.length}`);

  // Alle records voor Erika's Oddish (#001) — Pokemon
  const erika = cards.filter(
    (c) => /Erika.*Oddish/i.test(c.card_info.name) && c.card_info.card_number?.startsWith("001"),
  );
  console.log(`\nErika's Oddish records: ${erika.length}`);
  for (const c of erika) {
    console.log(`  "${c.card_info.name}" #${c.card_info.card_number}`);
    console.log("    cm.prices:", JSON.stringify(c.cardmarket?.prices));
    console.log("    tp.prices:", JSON.stringify(c.tcgplayer?.prices));
  }

  // Air Balloon (Trainer)
  const ab = cards.filter(
    (c) => /Air Balloon/i.test(c.card_info.name) && c.card_info.card_number?.startsWith("181"),
  );
  console.log(`\nAir Balloon records: ${ab.length}`);
  for (const c of ab) {
    console.log(`  "${c.card_info.name}" #${c.card_info.card_number}`);
    console.log("    cm.prices:", JSON.stringify(c.cardmarket?.prices));
    console.log("    tp.prices:", JSON.stringify(c.tcgplayer?.prices));
  }

  // Algemeen: zoek naar enige naam-patroon dat Ball/Energy aanduidt
  const variantNames = cards.filter(
    (c) =>
      /\((Ball|Energy)[^)]*Reverse[^)]*\)|\(Ball Pattern\)|\(Energy Pattern\)/i.test(
        c.card_info.name,
      ),
  );
  console.log(`\nCards met "(Ball/Energy ... Reverse/Pattern)" in naam: ${variantNames.length}`);
  for (const c of variantNames.slice(0, 5)) {
    console.log(`  "${c.card_info.name}" #${c.card_info.card_number}`);
  }

  // Verzamel ALLE unieke parenthese-suffixen in AH-card namen
  const suffixes = new Map<string, number>();
  for (const c of cards) {
    const m = c.card_info.name.match(/\(([^)]+)\)/);
    if (m) suffixes.set(m[1], (suffixes.get(m[1]) ?? 0) + 1);
  }
  console.log(`\nAlle parenthese-suffixen in AH (top 20):`);
  const sorted = [...suffixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [s, n] of sorted) console.log(`  "${s}": ${n}x`);
})();
