// Zoek Engelse pokewallet records met "Energy Symbol Pattern", "Friend Ball Pattern" etc.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(p: string) {
  const r = await fetch(`https://api.pokewallet.io${p}`, { headers: { "X-API-Key": KEY } });
  try { return await r.json(); } catch { return null; }
}

(async () => {
  const patterns = [
    "Energy Symbol Pattern",
    "Friend Ball Pattern",
    "Dusk Ball Pattern",
    "Love Ball Pattern",
    "Quick Ball Pattern",
    "Team Rocket Pattern",
    "Poke Ball Pattern Beautifly",
    "Energy Symbol Pattern Yanma",
    "Energy Symbol Pattern Pikachu",
  ];
  for (const q of patterns) {
    let allHits: { name: string; set: string; number: string }[] = [];
    for (let p = 1; p <= 5; p++) {
      const r = await api(`/search?q=${encodeURIComponent(q)}&page=${p}&limit=100`);
      const items = ((r.results ?? []) as Array<{ card_info: { name: string; set_name?: string; card_number?: string } }>);
      if (items.length === 0) break;
      for (const i of items) {
        allHits.push({ name: i.card_info.name, set: i.card_info.set_name ?? "?", number: i.card_info.card_number ?? "?" });
      }
      if (items.length < 100) break;
    }
    // Filter op set
    const byLang: Record<string, number> = {};
    const ah: typeof allHits = [];
    const eng: typeof allHits = [];
    for (const h of allHits) {
      if (h.set.includes("Ascended") || h.set.includes("ME0") || h.set === "ME: Ascended Heroes") ah.push(h);
      // Detect language by set-name pattern
      const isEng = !h.set.match(/^M\d|^S\d|^SM\d|^SP\d|^XY[A-Z]/) || /Heroes|Ascended|ME[: ]/i.test(h.set);
      const lang = isEng ? "eng" : "jap";
      byLang[lang] = (byLang[lang] ?? 0) + 1;
      if (isEng) eng.push(h);
    }
    console.log(`q="${q}": ${allHits.length} total  (eng:${byLang.eng ?? 0}, jap:${byLang.jap ?? 0}), AH-specific:${ah.length}`);
    for (const h of eng.slice(0, 5)) console.log(`  ENG: "${h.name}" set="${h.set}"`);
    for (const h of ah.slice(0, 3)) console.log(`  ★ AH: "${h.name}" #${h.number}`);
  }

  // Probeer M2a equivalent — cross-check: pokewallet heeft Japanse sets vaak met
  // ENGELSE-translated variants via een aparte set_id. Bv: 23599=JAP 151, 23237=ENG 151
  // Voor M2a (24499 JAP): wat is de ENG equivalent?
  // M2a release nov 2025, AH release 30 jan 2026 — TIJDLIJN past! AH = ENG release van M2a + M3?
  console.log("\n=== Direct: zoek alle Pattern records via /search ===");
  for (const p of [1, 2, 3, 4, 5]) {
    const r = await api(`/search?q=${encodeURIComponent("Pattern")}&page=${p}&limit=100`);
    const items = ((r.results ?? []) as Array<{ card_info: { name: string; set_name?: string } }>);
    if (items.length === 0) break;
    const ahHits = items.filter((i) => i.card_info.set_name?.includes("Ascended"));
    console.log(`page ${p}: ${items.length} hits, AH: ${ahHits.length}`);
    for (const h of ahHits.slice(0, 5)) console.log(`  ★ "${h.card_info.name}" set="${h.card_info.set_name}"`);
  }
})();
