// Diepe inspectie van een specifieke pattern variant — toont volledige
// cardmarket + tcgplayer arrays om te zien waar de echte pattern-prijs zit.
import "dotenv/config";
import { fetchAllPagesForSet, fetchSetViaCardLookup, getCard } from "../src/lib/pokewallet/client";

(async () => {
  // Test 1: Klink Master Ball uit Black Bolt
  console.log("=== Klink Master Ball Pattern (BB #061) ===");
  const bb = await fetchAllPagesForSet("24325");
  const klinkPattern = bb.filter(c => c.card_info.name.includes("Klink") && c.card_info.card_number?.startsWith("061"));
  for (const c of klinkPattern) {
    console.log(`\n${c.card_info.name}`);
    console.log("  cardmarket:", JSON.stringify(c.cardmarket, null, 2));
    console.log("  tcgplayer.prices:", JSON.stringify(c.tcgplayer?.prices, null, 2));
  }

  // Test 2: een Ascended Heroes kaart met Energy in naam
  console.log("\n\n=== Ascended Heroes — alle naming patterns ===");
  const ah = await fetchSetViaCardLookup("24541");
  // Zoek varianten via naam-filter
  const variants = ah.filter(c => /\b(Ball|Energy|Pattern|Reverse)\b/i.test(c.card_info.name));
  console.log(`Gevonden ${variants.length} varianten via naam:`);
  for (const c of variants.slice(0, 10)) {
    console.log(`  "${c.card_info.name}" #${c.card_info.card_number}`);
  }

  // Test 3: AH Energy + Trainer card variants (Energy/Ball Reverse Holo)
  console.log("\n\n=== AH Energy + Item/Trainer cards ===");
  const energyAndItems = ah.filter(c =>
    /Energy|Ball|Potion|Switch/i.test(c.card_info.name) &&
    !/Mini Tin|Collection|Display/i.test(c.card_info.name)
  );
  for (const c of energyAndItems.slice(0, 10)) {
    const cmHolo = c.cardmarket?.prices?.find(p => p.variant_type === "holo");
    const cmNorm = c.cardmarket?.prices?.find(p => p.variant_type === "normal");
    const tpHolo = c.tcgplayer?.prices?.find(p => p.sub_type_name === "Holofoil");
    const tpRev = c.tcgplayer?.prices?.find(p => p.sub_type_name === "Reverse Holofoil");
    const tpNorm = c.tcgplayer?.prices?.find(p => p.sub_type_name === "Normal");
    console.log(`  "${c.card_info.name}" #${c.card_info.card_number}`);
    console.log(`    CM normal=${cmNorm?.avg ?? "—"}  holo=${cmHolo?.avg ?? "—"}`);
    console.log(`    TP Normal=$${tpNorm?.market_price ?? "—"}  Holo=$${tpHolo?.market_price ?? "—"}  Reverse=$${tpRev?.market_price ?? "—"}`);
  }

  // Test 4: zoek alle card_numbers die meer dan 1 record hebben
  const ahByNum = new Map<string, typeof ah>();
  for (const c of ah) {
    const num = c.card_info.card_number?.split("/")[0]?.trim() ?? "";
    if (!num) continue;
    if (!ahByNum.has(num)) ahByNum.set(num, []);
    ahByNum.get(num)!.push(c);
  }
  console.log("\n=== AH cards met >1 record per nummer ===");
  let dupCount = 0;
  for (const [num, list] of ahByNum) {
    if (list.length > 1) {
      dupCount++;
      console.log(`  #${num}: ${list.map(c => `"${c.card_info.name}"`).join(", ")}`);
    }
  }
  console.log(`Totaal: ${dupCount} card_number-collisions`);
})();
