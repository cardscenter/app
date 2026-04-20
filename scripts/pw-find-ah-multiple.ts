import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return await r.json();
}
(async () => {
  // Test diverse Pokemon-commons in AH (verschillende rariteiten en cards)
  const testCards = [
    "Pikachu",        // common
    "Snorunt",        // common
    "Marill",         // common
    "Numel",          // common
    "Cinderace",      // ex misschien
    "Hawlucha",       // pokemon
    "Tepig",          // common
    "Litwick",        // common
    "Charmander",     // common
    "Bulbasaur",
    "Squirtle",
  ];

  for (const name of testCards) {
    const r = await api(`/search?q=${encodeURIComponent(name + " Ascended")}&limit=30`);
    const items = (r.results || []).filter(
      (i: { card_info?: { set_name?: string; name?: string } }) =>
        i.card_info?.set_name?.includes("Ascended"),
    );
    if (items.length === 0) continue;
    console.log(`\n=== "${name}" in AH (${items.length} records) ===`);
    for (const i of items) {
      const has = /\(.*Pattern.*\)|\(.*Reverse.*\)|Ball|Energy/i.test(i.card_info?.name ?? "");
      const marker = has ? "★" : " ";
      console.log(`  ${marker} "${i.card_info?.name}" #${i.card_info?.card_number}`);
    }
  }
})();
