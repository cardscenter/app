// Brute-force scan: probeer alle set_ids 24500-24700, alle alternative
// set_codes, en kijk of er hidden sub-sets zijn die AH variants bevatten.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string, raw = false) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  if (raw) return { status: r.status, text: await r.text() };
  try { return { status: r.status, body: await r.json() }; }
  catch { return { status: r.status, body: null as unknown }; }
}

(async () => {
  // 1. Brute-force set_ids 24500-24700
  console.log("=== Brute-force set_ids 24500-24700 ===");
  const found: { id: number; name: string; cards: number }[] = [];
  for (let id = 24500; id <= 24700; id++) {
    const r = await api(`/sets/${id}?limit=1`);
    if (r.status === 200) {
      const set = (r.body as { set?: { name?: string; total_cards?: number } }).set;
      if (set) found.push({ id, name: set.name ?? "?", cards: set.total_cards ?? 0 });
    }
  }
  console.log(`Gevonden: ${found.length} sets in range`);
  for (const s of found) console.log(`  ${s.id}: cards=${s.cards}  "${s.name}"`);

  // 2. Probeer alternative set_code-vorm (ASC2, ASCB, ASCV, ASC_V, etc.)
  console.log("\n=== Alt set_code's ===");
  for (const code of ["ASC2", "ASCV", "ASCP", "ASC-V", "ASC-B", "ASC_BALL", "ASCB", "ASCE", "MASC", "MEASC", "ME02.5"]) {
    const r = await api(`/sets/${encodeURIComponent(code)}?limit=5`);
    if (r.status === 200) {
      const body = r.body as { set?: { name?: string }; cards?: unknown[] };
      console.log(`  [200] /sets/${code}  → "${body.set?.name}" cards=${body.cards?.length}`);
    }
  }

  // 3. Pokewallet's /sets endpoint heeft soms paginatie — probeer alle pages
  console.log("\n=== /sets met paginatie ===");
  for (let p = 1; p <= 20; p++) {
    const r = await api(`/sets?page=${p}&limit=200`);
    const body = r.body as { data?: unknown[]; pagination?: { total_pages?: number } };
    const cnt = body.data?.length ?? 0;
    console.log(`  page ${p}: ${cnt} sets, total_pages=${body.pagination?.total_pages ?? "?"}`);
    if (cnt < 200) break;
  }

  // 4. Search met andere termen die mss naar AH wijzen
  console.log("\n=== Bizarre AH search-termen ===");
  for (const q of [
    "Erika Oddish 218",
    "Erika 1",
    "Pikachu 55",
    "Pikachu 56",
    "ASC 001 Ball",
    "ASC 1 Ball",
    "Erika Oddish Cosmic",
    "Erika Oddish Holo",
    "Pikachu Cosmic",
    "Cosmic Holo Pokémon Ascended",
    "Galaxy Holo",
    "Pikachu 50",
    "Pikachu 1",
    "Ascended Heroes Variants",
    "Ascended Heroes 218",
    "Ascended Heroes Secret",
    "Ascended Heroes Master",
    "Master Ball Pattern Pikachu",
    "Erika Oddish Master Ball",
  ]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const items = ((r.body as { results?: Array<{ card_info?: { name?: string; set_name?: string; card_number?: string } }> }).results ?? []).filter(
      (i) => i.card_info?.set_name?.includes("Ascended"),
    );
    if (items.length > 0) {
      console.log(`  ★ "${q}" → ${items.length} AH-hits`);
      for (const i of items.slice(0, 3)) console.log(`     "${i.card_info?.name}" #${i.card_info?.card_number}`);
    }
  }

  // 5. Pokewallet card-id formaat is pk_<hex>. Probeer voor Erika base-id andere chars.
  // Slaat over want pk-IDs zijn random hashes, niet incrementeel.

  // 6. Probeer GET /sets/24541 met ?expand=variants of related parameters
  console.log("\n=== Alternative /sets/24541 ===");
  for (const p of [
    "?show_variants=true",
    "?show_pattern_variants=true",
    "?include_pattern=true",
    "?show=variants",
    "?show=patterns",
    "?show=alt_arts",
    "?show=secondary",
    "?include[]=variants",
    "?with[]=patterns",
    "?embed=variants",
  ]) {
    const r = await api(`/sets/24541${p}&limit=500`);
    const body = r.body as { cards?: unknown[]; total_cards?: number; set?: { total_cards?: number } };
    const cnt = body.cards?.length ?? 0;
    const tot = body.set?.total_cards;
    if (cnt > 200 || (tot && tot > 307)) {
      console.log(`  ★ ${p}: cards=${cnt} total=${tot}`);
    }
  }
})();
