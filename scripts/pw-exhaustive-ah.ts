// Exhaustive search voor AH Ball/Energy Reverse Holo varianten.
// Probeer ALLES: alle endpoints, alle parameters, alle naming-patterns.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;

async function api(path: string, raw = false): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return { status: r.status, body: raw ? await r.text() : await r.json() };
}

const ahErikaPwId = "pk_e8d04323810d19b9647bac72e65c22b5fc712fbb15694ef3297cf691c59f74a9e3936a083f65c657516b702ac197";

(async () => {
  console.log("====== EXHAUSTIVE AH VARIANT SEARCH ======\n");

  // 1. ALLE search-termen die mogelijk variants matchen
  const searchTerms = [
    "Erika Oddish (Ball)",
    "Erika Oddish (Energy)",
    "Pikachu (Ball)",
    "Pikachu (Energy)",
    "Erika Oddish 1 Ball",
    "Erika Oddish 1 Energy",
    "Pikachu 55 Ball",
    "Pikachu 55 Energy",
    "Pikachu 55/217 (Ball Reverse Holo)",
    "Pikachu Ball Reverse Holo Ascended",
    "Pikachu Energy Reverse Holo Ascended",
    "Erika Oddish Ball Reverse",
    "(Ball Reverse Holo)",
    "(Energy Reverse Holo)",
    "Ball Reverse Pattern Pikachu",
    "Pokémon Ball",
    "Master Ball Pattern Ascended",
    "ASC Master Ball",
    "Cinderace ex Ball",
  ];
  console.log("--- 1. Search-terms ---");
  for (const q of searchTerms) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const items = ((r.body as { results?: Array<{ card_info?: { name?: string; set_name?: string; card_number?: string } }> }).results ?? []).filter(
      (i) => i.card_info?.set_name?.includes("Ascended"),
    );
    if (items.length > 0) {
      console.log(`  ★ "${q}" → ${items.length} AH-hits`);
      for (const i of items.slice(0, 3)) console.log(`     "${i.card_info?.name}" #${i.card_info?.card_number}`);
    }
  }

  // 2. Direct probeer /cards/{erika_id}/variants etc.
  console.log("\n--- 2. /cards/{id}/* sub-endpoints ---");
  for (const sub of ["variants", "alt", "alternates", "related", "patterns", "siblings", "products"]) {
    const r = await api(`/cards/${ahErikaPwId}/${sub}`);
    console.log(`  [${r.status}] /cards/{erika}/${sub}`);
  }

  // 3. /sets/24541 + diverse parameters
  console.log("\n--- 3. /sets/24541 + parameters ---");
  for (const p of [
    "?include=variants",
    "?include=alt_arts",
    "?include=patterns",
    "?include=all",
    "?with_variants=1",
    "?show_alt=1",
    "?expand=all",
    "?fields=variants",
    "?type=variants",
    "?type=patterns",
    "?type=reverse",
    "?include_alt_arts=true",
    "?language=all",
    "?language=eng",
    "?lang=eng",
    "?show_all=1",
    "?include_subset=1",
  ]) {
    const r = await api(`/sets/24541${p}&limit=500`);
    const cnt = (r.body as { cards?: unknown[] }).cards?.length ?? 0;
    console.log(`  [${r.status}] /sets/24541${p}  cards=${cnt}`);
  }

  // 4. Andere top-level endpoints
  console.log("\n--- 4. Andere endpoints ---");
  for (const path of [
    "/products?set_id=24541",
    "/variants?set_id=24541",
    "/variants/24541",
    "/sets/24541/products",
    "/sets/24541/sealed",
    "/sets/24541/full",
    "/cards?set_id=24541&limit=500",
    "/cards?set=24541&limit=500",
    "/cards?set_code=ASC&limit=500",
    "/sets/24541/listing",
    "/sets/24541/extended",
    "/sets/24541/secondary",
    "/sets/24541/holo",
    "/sets/24541/reverse",
  ]) {
    const r = await api(path);
    const body = r.body as { cards?: unknown[]; results?: unknown[]; data?: unknown[] };
    const cnt = body.cards?.length ?? body.results?.length ?? body.data?.length ?? "—";
    console.log(`  [${r.status}] ${path}  count=${cnt}`);
  }

  // 5. Probeer of er via search OP set_id=24541 met specifieke filters meer komt
  console.log("\n--- 5. /search met diverse parameters ---");
  for (const p of [
    "?q=24541&limit=500",
    "?q=ASC&limit=500",
    "?q=ME%20Ascended&limit=500",
    "?set_id=24541&limit=500",
    "?set=24541&limit=500",
    "?set_code=ASC&limit=500",
    "?q=*&set_id=24541&limit=500",
    "?q=Ascended%20Heroes%20Reverse&limit=100",
    "?q=Ascended%20Heroes%20Holo&limit=100",
  ]) {
    const r = await api(`/search${p}`);
    const body = r.body as { results?: unknown[]; total?: number; cards?: unknown[] };
    const cnt = body.results?.length ?? body.cards?.length ?? "—";
    console.log(`  [${r.status}] /search${p}  count=${cnt}, total=${body.total ?? "?"}`);
  }

  // 6. Volledige /cards/{id} dump om eventuele velden te zien die ik heb gemist
  console.log("\n--- 6. Volledige Erika /cards response ---");
  const r6 = await api(`/cards/${ahErikaPwId}`);
  console.log("Keys top-level:", Object.keys(r6.body as object).join(", "));
  console.log("Full body:", JSON.stringify(r6.body, null, 2).slice(0, 2500));
})();
