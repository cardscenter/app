// Zoek pokewallet records voor de V2/V3 variants van AH-cards.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  try { return { status: r.status, body: await r.json() }; }
  catch { return { status: r.status, body: null }; }
}

(async () => {
  // 1. ALLE Tangela-records via /search en filter op naming patterns
  console.log("=== ALL Tangela-records ===");
  const allTangela: { id: string; name: string; number: string; set: string }[] = [];
  for (let p = 1; p <= 10; p++) {
    const r = await api(`/search?q=Tangela&page=${p}&limit=100`);
    const items = ((r.body as { results?: Array<{ id: string; card_info: { name: string; card_number?: string; set_name?: string } }> }).results ?? []);
    if (items.length === 0) break;
    for (const i of items) {
      allTangela.push({ id: i.id, name: i.card_info.name, number: i.card_info.card_number ?? "?", set: i.card_info.set_name ?? "?" });
    }
    if (items.length < 100) break;
  }
  console.log(`Total Tangela records: ${allTangela.length}`);
  const ahTangela = allTangela.filter((t) => t.set.includes("Ascended"));
  console.log(`AH Tangela: ${ahTangela.length}`);
  for (const t of ahTangela) console.log(`  pwId=${t.id.slice(0, 18)} "${t.name}" #${t.number}`);

  // 2. Pokewallet specifieke search met "V1", "V2"
  console.log("\n=== /search met V1/V2/V3 termen ===");
  for (const q of ["Tangela V1", "Tangela V2", "Tangela V3", "Erika V2 Tangela", "ASC V2", "ASC V1", "Ascended V2", "Ascended V1", "ASC 007 V2", "Tangela ASC V2"]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const items = ((r.body as { results?: Array<{ card_info: { name: string; set_name?: string; card_number?: string } }> }).results ?? []);
    const ahItems = items.filter((i) => i.card_info.set_name?.includes("Ascended"));
    if (ahItems.length > 0) {
      console.log(`  ★ "${q}": ${ahItems.length} AH-hits`);
      for (const i of ahItems.slice(0, 3)) console.log(`     "${i.card_info.name}" #${i.card_info.card_number}`);
    } else if (items.length > 0) {
      console.log(`  "${q}": ${items.length} hits (geen AH)`);
    }
  }

  // 3. Probeer endpoints met cardmarket_id of product_url
  console.log("\n=== Cardmarket-based endpoints ===");
  for (const path of [
    "/cardmarket/Pikachu-ASC055",
    "/products/Pikachu-ASC055",
    "/sku/ASC055",
    "/skus?set=24541",
    "/products?cm_set=Ascended-Heroes",
    "/cardmarket/product?url=Pikachu-ASC055",
    "/cards?cardmarket_id=Pikachu-ASC055",
    "/cards?cardmarket_url=Pikachu-ASC055",
  ]) {
    const r = await api(path);
    if (r.status !== 404) console.log(`  [${r.status}] ${path}`);
  }

  // 4. Probeer of /search met andere parameters helpt
  console.log("\n=== /search met andere parameters ===");
  for (const path of [
    "/search?q=ASC&type=variant&limit=200",
    "/search?q=ASC&filter=variant&limit=200",
    "/search?q=ASC&include_variants=1&limit=200",
    "/search?q=ASC&show=all&limit=200",
    "/search?q=ASC&include=all&limit=200",
    "/search?q=ASC&include=variants&limit=200",
    "/search?q=Ascended%20Heroes&include=variants&limit=200",
    "/search?q=ASC&deep=1&limit=200",
    "/search?q=ASC&full=1&limit=200",
  ]) {
    const r = await api(path);
    const cnt = ((r.body as { results?: unknown[] }).results ?? []).length;
    console.log(`  [${r.status}] ${path} → ${cnt} hits`);
  }
})();
