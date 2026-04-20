// Test Pro-tier endpoints en check of CardMarket URL's V2/V3-suffixen hebben.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  try { return { status: r.status, body: await r.json() }; }
  catch { return { status: r.status, body: null }; }
}

(async () => {
  // Pro-endpoints voor AH
  console.log("=== Pro-endpoints voor /sets/24541 ===");
  for (const path of [
    "/sets/24541/statistics",
    "/sets/24541/statistics?variant=normal",
    "/sets/24541/statistics?variant=holo",
    "/sets/24541/completion-value",
    "/sets/24541/completion-value?detailed=1",
    "/sets/24541/sealed",
    "/sets/24541/items",
    "/sets/24541/skus",
    "/sets/24541/all-products",
    "/sets/24541/details",
    "/sets/24541/extended",
  ]) {
    const r = await api(path);
    console.log(`  [${r.status}] ${path}`);
    if (r.status === 200) {
      const body = r.body as { rarity_breakdown?: unknown; cards?: unknown[]; data?: unknown[] };
      const keys = Object.keys(body || {}).slice(0, 8).join(", ");
      console.log(`    keys: ${keys}`);
    }
  }

  // Statistics in detail
  console.log("\n=== /sets/24541/statistics (full body) ===");
  const stats = await api(`/sets/24541/statistics`);
  if (stats.status === 200) {
    console.log(JSON.stringify(stats.body, null, 2).slice(0, 1500));
  }

  // CardMarket URL's: kijk of er V2/V3 suffixen in URLs zijn voor AH cards
  console.log("\n=== CardMarket URL-patterns in AH cards ===");
  const r = await api(`/sets/24541?limit=200&page=1`);
  const cards = ((r.body as { cards?: Array<{ card_info: { name: string; card_number: string }; cardmarket?: { product_url?: string } }> }).cards ?? []);
  const urls = new Map<string, number>();
  for (const c of cards) {
    const url = c.cardmarket?.product_url ?? "";
    // Extract URL pattern (V1/V2/V3 etc)
    const m = url.match(/-V\d+-/);
    if (m) {
      urls.set(m[0], (urls.get(m[0]) ?? 0) + 1);
    }
  }
  console.log(`  cards with V[N] in URL: ${[...urls.values()].reduce((s, n) => s + n, 0)}`);
  for (const [v, n] of urls) console.log(`    ${v}: ${n}x`);

  // Voorbeeld URLs van cards
  console.log("\n  Sample URLs (eerste 20):");
  for (const c of cards.slice(0, 20)) {
    console.log(`    "${c.card_info.name}" → ${c.cardmarket?.product_url ?? "(no url)"}`);
  }

  // Check page 2 ook
  console.log("\n  Sample URLs (page 2 — laatste 20):");
  const r2 = await api(`/sets/24541?limit=200&page=2`);
  const cards2 = ((r2.body as { cards?: Array<{ card_info: { name: string; card_number: string }; cardmarket?: { product_url?: string } }> }).cards ?? []);
  for (const c of cards2.slice(-20)) {
    console.log(`    "${c.card_info.name}" #${c.card_info.card_number} → ${c.cardmarket?.product_url ?? "(no url)"}`);
  }
})();
