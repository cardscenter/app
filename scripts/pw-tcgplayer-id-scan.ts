// TCGPlayer product-IDs binnen een set zijn sequentieel.
// Verzamel alle AH TCGPlayer-IDs en zoek de gap.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(p: string) {
  const r = await fetch(`https://api.pokewallet.io${p}`, { headers: { "X-API-Key": KEY } });
  try { return { status: r.status, body: await r.json() }; }
  catch { return { status: r.status, body: null }; }
}

(async () => {
  // 1. Verzamel ALLE TCGPlayer URLs van AH cards
  const allCards: { name: string; number: string; tcgUrl?: string; tcgId?: number; cmUrl?: string }[] = [];
  for (const page of [1, 2]) {
    const r = await api(`/sets/24541?limit=200&page=${page}`);
    const cards = (r.body.cards ?? []) as Array<{ card_info: { name: string; card_number: string }; tcgplayer?: { url?: string }; cardmarket?: { product_url?: string } }>;
    for (const c of cards) {
      const tcgUrl = c.tcgplayer?.url ?? "";
      const m = tcgUrl.match(/\/product\/(\d+)/);
      const tcgId = m ? parseInt(m[1]) : undefined;
      allCards.push({
        name: c.card_info.name,
        number: c.card_info.card_number ?? "?",
        tcgUrl,
        tcgId,
        cmUrl: c.cardmarket?.product_url,
      });
    }
  }
  console.log(`Total AH cards via /sets: ${allCards.length}`);
  const withTcgId = allCards.filter((c) => c.tcgId);
  console.log(`Met TCGPlayer ID: ${withTcgId.length}`);

  // 2. Sorteer op TCGPlayer ID en kijk naar de range
  withTcgId.sort((a, b) => (a.tcgId! - b.tcgId!));
  const minId = withTcgId[0].tcgId!;
  const maxId = withTcgId[withTcgId.length - 1].tcgId!;
  console.log(`TCGPlayer ID range: ${minId} – ${maxId}  (gap: ${maxId - minId})`);
  console.log(`Eerste 5: ${withTcgId.slice(0, 5).map(c => `#${c.number}=${c.tcgId}`).join(", ")}`);
  console.log(`Laatste 5: ${withTcgId.slice(-5).map(c => `#${c.number}=${c.tcgId}`).join(", ")}`);

  // 3. Detecteer gaps in de range
  const ids = withTcgId.map(c => c.tcgId!);
  const idSet = new Set(ids);
  const missing: number[] = [];
  for (let i = minId; i <= maxId; i++) {
    if (!idSet.has(i)) missing.push(i);
  }
  console.log(`\nGaps in range: ${missing.length} missende TCGPlayer IDs`);
  console.log(`Sample missing IDs: ${missing.slice(0, 20).join(", ")}`);

  // 4. Probeer pokewallet via /search met tcgplayer URL/id (vaak werken numerieke termen)
  console.log("\n=== Probeer pokewallet /search met TCG product IDs ===");
  for (const id of missing.slice(0, 5)) {
    const r = await api(`/search?q=${id}&limit=10`);
    const items = ((r.body.results ?? []) as Array<{ card_info: { name?: string; set_name?: string } }>);
    const ah = items.filter(i => i.card_info.set_name?.includes("Ascended"));
    console.log(`  TCG=${id}: ${items.length} hits totaal, ${ah.length} AH`);
    for (const i of ah.slice(0, 3)) console.log(`    "${i.card_info.name}" set="${i.card_info.set_name}"`);
  }

  // 5. Probeer /cards/{tcgplayer-id} en variants
  console.log("\n=== Probeer /cards/<tcg-id> met first-missing ID ===");
  if (missing.length > 0) {
    const id = missing[0];
    for (const path of [`/cards/${id}`, `/cards/tcg_${id}`, `/cards/tcgplayer/${id}`, `/products/${id}`]) {
      const r = await api(path);
      console.log(`  [${r.status}] ${path}`);
    }
  }
})();
