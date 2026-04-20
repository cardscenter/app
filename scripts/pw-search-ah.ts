import "dotenv/config";

const KEY = process.env.POKEWALLET_API_KEY!;

async function search(q: string) {
  const r = await fetch(
    `https://api.pokewallet.io/search?q=${encodeURIComponent(q)}&limit=20`,
    { headers: { "X-API-Key": KEY } },
  );
  return await r.json();
}

(async () => {
  const queries = [
    "Erika Oddish Ball Reverse",
    "Air Balloon Energy",
    "Erika's Oddish 001",
    "Ball Reverse Holo",
    "Energy Reverse Holo",
  ];
  for (const q of queries) {
    const r = await search(q);
    console.log(`\n--- q: "${q}" ---`);
    console.log(`  total: ${r.total ?? r.results?.length ?? "?"}`);
    const items = r.results ?? [];
    for (const item of items.slice(0, 5)) {
      console.log(`    "${item.card_info?.name ?? "?"}" #${item.card_info?.card_number ?? "?"} set=${item.card_info?.set_name ?? "?"}`);
    }
  }
})();
