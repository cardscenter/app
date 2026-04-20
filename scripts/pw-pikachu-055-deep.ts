// Diepe focus op Pikachu #055 in Ascended Heroes — alle hoeken bekijken.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return { status: r.status, body: await r.json() };
}

(async () => {
  // 1. Vind eerst de Pikachu #055 base pwId
  const r = await api(`/search?q=${encodeURIComponent("Pikachu Ascended")}&limit=20`);
  const pikachu055 = ((r.body as { results?: Array<{ id: string; card_info: { name: string; card_number: string; set_name: string } }> }).results ?? []).find(
    (c) => c.card_info.name === "Pikachu" && c.card_info.card_number === "055/217",
  );
  if (!pikachu055) { console.log("Pikachu #055 niet gevonden"); return; }
  console.log(`Pikachu #055 base pwId: ${pikachu055.id}\n`);

  // 2. Volledige /cards/{pikachu} response — alle velden inspecteren
  console.log("=== /cards/{pikachu_055} VOLLEDIGE RESPONSE ===");
  const cardResp = await api(`/cards/${pikachu055.id}`);
  console.log(JSON.stringify(cardResp.body, null, 2));

  // 3. Probeer ALLE Pikachu records via search en filter op AH
  console.log("\n=== Alle Pikachu records (gepagineerd) ===");
  const allPikachu: { id: string; name: string; number: string; set: string }[] = [];
  for (let p = 1; p <= 20; p++) {
    const sr = await api(`/search?q=${encodeURIComponent("Pikachu")}&page=${p}&limit=100`);
    const items = ((sr.body as { results?: Array<{ id: string; card_info: { name: string; card_number?: string; set_name?: string } }> }).results ?? []);
    if (items.length === 0) break;
    for (const i of items) {
      allPikachu.push({ id: i.id, name: i.card_info.name, number: i.card_info.card_number ?? "?", set: i.card_info.set_name ?? "?" });
    }
    if (items.length < 100) break;
  }
  console.log(`Totaal Pikachu records: ${allPikachu.length}`);
  const ahPikachu = allPikachu.filter((p) => p.set.includes("Ascended"));
  console.log(`AH Pikachu records: ${ahPikachu.length}`);
  for (const p of ahPikachu) {
    console.log(`  pwId=${p.id.slice(0, 18)}  "${p.name}" #${p.number}  set="${p.set}"`);
  }

  // 4. Zoek ALLE records met "Pikachu" + "Ball" or "Energy"
  console.log("\n=== Pikachu + Ball/Energy variants in pokewallet ===");
  for (const q of ["Pikachu Master Ball Pattern", "Pikachu Poke Ball Pattern", "Pikachu Ball Reverse", "Pikachu Energy Reverse", "Pikachu (Ball)", "Pikachu (Energy)"]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const items = ((r.body as { results?: Array<{ card_info: { name: string; set_name?: string; card_number?: string } }> }).results ?? []);
    console.log(`  q="${q}": ${items.length} hits`);
    for (const i of items.slice(0, 5)) {
      console.log(`    "${i.card_info.name}" #${i.card_info.card_number} set="${i.card_info.set_name}"`);
    }
  }

  // 5. Totaal tellen records voor SV-era variants als sanity check
  console.log("\n=== SV-era Pattern records (voor vergelijking) ===");
  for (const q of ["Klink Master Ball Pattern", "Snivy Master Ball Pattern", "Pikachu Black Bolt", "Pikachu White Flare"]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const items = ((r.body as { results?: Array<{ card_info: { name: string; set_name?: string; card_number?: string } }> }).results ?? []);
    console.log(`  q="${q}": ${items.length} hits`);
    for (const i of items.slice(0, 5)) {
      console.log(`    "${i.card_info.name}" set="${i.card_info.set_name}"`);
    }
  }
})();
