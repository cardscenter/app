import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;

async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return await r.json();
}

(async () => {
  // Wildcard search met set_id en/of set_code — pagineer alle resultaten
  const allResults = new Map<string, { name: string; number: string; set_name: string }>();

  for (const q of ["ASC", "Ascended Heroes", "*", "ASC 001", "ASC pikachu", "ASC erika"]) {
    let page = 1;
    while (page <= 20) {
      const url = `/search?q=${encodeURIComponent(q)}&page=${page}&limit=100`;
      const r = await api(url);
      const items = r.results || [];
      if (items.length === 0) break;
      for (const i of items) {
        if (!i.card_info?.set_name?.includes("Ascended")) continue;
        if (!allResults.has(i.id)) {
          allResults.set(i.id, {
            name: i.card_info.name,
            number: i.card_info.card_number ?? "?",
            set_name: i.card_info.set_name,
          });
        }
      }
      if (items.length < 100) break;
      page++;
    }
  }
  console.log(`Totaal unieke AH-records via search-aggregatie: ${allResults.size}`);

  // Tel suffix-types
  const suffixCounts = new Map<string, number>();
  for (const [, v] of allResults) {
    const m = v.name.match(/\(([^)]+)\)|\[([^\]]+)\]| - \d+\/\d+/);
    const suffix = m ? (m[1] ?? m[2] ?? "_alt-art-num_") : "_no-suffix_";
    suffixCounts.set(suffix, (suffixCounts.get(suffix) ?? 0) + 1);
  }
  console.log("\nSuffix-tellingen:");
  const sorted = [...suffixCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [s, n] of sorted.slice(0, 20)) console.log(`  "${s}": ${n}x`);

  // Filter naar cards met "Ball" of "Energy" in suffix
  const ballOrEnergy = [...allResults.values()].filter((v) =>
    /\((Ball|Energy|Master|Poke|Reverse|Pattern|Finish)/i.test(v.name),
  );
  console.log(`\nAH-cards met Ball/Energy/Master/Poke/Reverse/Pattern in naam: ${ballOrEnergy.length}`);
  for (const v of ballOrEnergy.slice(0, 20)) console.log(`  "${v.name}" #${v.number}`);

  // Specifiek: voor Pikachu zoek alle records via /cards/{id}
  console.log("\n--- /search Pikachu Common AH ---");
  const r = await api("/search?q=Pikachu%20Common%20Ascended&limit=100");
  for (const i of (r.results || []).slice(0, 20)) {
    console.log(`  "${i.card_info?.name}" #${i.card_info?.card_number} set="${i.card_info?.set_name}"`);
  }

  // Probeer search met andere taal
  console.log("\n--- /search met language=eng explicit ---");
  for (const q of ["ASC", "Ascended Heroes Pikachu"]) {
    for (const lang of ["", "&language=eng", "&lang=eng", "&lang=all"]) {
      const r = await api(`/search?q=${encodeURIComponent(q)}&limit=100${lang}`);
      const items = (r.results || []).filter((i: { card_info?: { set_name?: string } }) => i.card_info?.set_name?.includes("Ascended"));
      console.log(`  q="${q}"${lang}: ${items.length} AH-hits`);
    }
  }

  // Probeer ?include=hidden — sommige API's hebben dat
  console.log("\n--- /sets/24541 met more obscure params ---");
  for (const p of ["?show_hidden=1", "?status=all", "?visibility=all", "?include_hidden=1", "?secondary_market=1", "?holo_only=1", "?reverse_only=1"]) {
    const r = await api(`/sets/24541${p}&limit=500`);
    console.log(`  ${p}: cards=${r.cards?.length ?? 0}`);
  }
})();
