import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return await r.json();
}
(async () => {
  // Alle Erika's Oddish records
  console.log("=== /search?q=Erika%27s%20Oddish ===");
  const r = await api(`/search?q=${encodeURIComponent("Erika's Oddish")}&limit=100`);
  const items = r.results || [];
  console.log(`Total: ${r.total ?? items.length}`);
  for (const i of items) {
    console.log(`  pwId=${i.id?.slice(0, 16)}... "${i.card_info?.name}" #${i.card_info?.card_number} set="${i.card_info?.set_name}"`);
  }

  // Alle Erika's records (alle Erika cards)
  console.log("\n=== /search?q=Erika%27s ===");
  const r2 = await api(`/search?q=${encodeURIComponent("Erika's")}&limit=100`);
  const items2 = r2.results || [];
  console.log(`Total: ${r2.total ?? items2.length}`);
  const ah = items2.filter((i: { card_info?: { set_name?: string } }) =>
    i.card_info?.set_name?.includes("Ascended"),
  );
  console.log(`AH only: ${ah.length}`);
  for (const i of ah.slice(0, 20)) {
    console.log(`  pwId=${i.id?.slice(0, 16)}... "${i.card_info?.name}" #${i.card_info?.card_number}`);
  }

  // Search alle ME / ASC met "Ball" in naam
  console.log("\n=== /search?q=ASC%20Ball ===");
  const r3 = await api(`/search?q=ASC%20Ball&limit=100`);
  const items3 = (r3.results || []).filter(
    (i: { card_info?: { set_name?: string } }) => i.card_info?.set_name?.includes("Ascended"),
  );
  for (const i of items3.slice(0, 20)) {
    console.log(`  "${i.card_info?.name}" #${i.card_info?.card_number} set="${i.card_info?.set_name}"`);
  }

  // Random AH-card via search om te zien hoeveel records het returnt
  console.log("\n=== /search?q=Air%20Balloon%20Ascended ===");
  const r4 = await api(`/search?q=${encodeURIComponent("Air Balloon Ascended")}&limit=100`);
  const items4 = r4.results || [];
  console.log(`Total: ${r4.total ?? items4.length}`);
  for (const i of items4.slice(0, 10)) {
    console.log(`  pwId=${i.id?.slice(0, 16)}... "${i.card_info?.name}" #${i.card_info?.card_number} set="${i.card_info?.set_name}"`);
  }

  // Pikachu in AH (mss: Erika is geen common in AH base, of speciale Pokemon)
  console.log("\n=== /search?q=Pikachu%20Ascended ===");
  const r5 = await api(`/search?q=${encodeURIComponent("Pikachu Ascended")}&limit=100`);
  const items5 = (r5.results || []).filter(
    (i: { card_info?: { set_name?: string } }) => i.card_info?.set_name?.includes("Ascended"),
  );
  console.log(`AH-Pikachu: ${items5.length}`);
  for (const i of items5.slice(0, 10)) {
    console.log(`  "${i.card_info?.name}" #${i.card_info?.card_number}`);
  }
})();
