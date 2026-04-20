import "dotenv/config";

const KEY = process.env.POKEWALLET_API_KEY!;

async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, {
    headers: { "X-API-Key": KEY },
  });
  return await r.json();
}

(async () => {
  // 1. Pokewallet card_id van basis Erika's Oddish
  const erikaId = "pk_e8d04323810d19b9647bac72e65c22b5fc712fbb15694ef3297cf691c59f74a9e3936a083f65c657516b702ac197";
  console.log("=== /cards/{erika_basis} ===");
  const cardResp = await api(`/cards/${erikaId}`);
  console.log("keys:", Object.keys(cardResp));
  console.log("card_info.name:", cardResp.card_info?.name);
  console.log("variants array?", cardResp.variants ?? "(none)");
  console.log("related?", cardResp.related ?? "(none)");
  console.log("alt_versions?", cardResp.alt_versions ?? "(none)");

  // 2. /search met set_id + card_number
  for (const q of ["24541 1", "24541 001", "Erika Oddish 001 Ball", "Oddish Ball Reverse Holo"]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=20`);
    console.log(`\n--- /search?q=${q} → total ${r.total ?? 0} ---`);
    for (const item of (r.results || []).slice(0, 5)) {
      console.log(`  "${item.card_info?.name}" #${item.card_info?.card_number} pwId=${item.id?.slice(0, 18)}`);
    }
  }

  // 3. Ascended Heroes via /sets/{id}/cards (different endpoint?)
  console.log("\n=== /sets/24541/cards ===");
  try {
    const r = await api("/sets/24541/cards?limit=10");
    console.log("keys:", Object.keys(r));
    console.log("first card:", JSON.stringify(r.cards?.[0] ?? r.results?.[0])?.slice(0, 200));
  } catch (e) { console.log("error:", String(e).slice(0, 100)); }

  // 4. Het basis /sets/{id} endpoint
  console.log("\n=== /sets/24541 ===");
  const setResp = await api("/sets/24541?limit=5");
  console.log("keys:", Object.keys(setResp));
  console.log("set:", JSON.stringify(setResp.set)?.slice(0, 200));
  console.log("cards length:", setResp.cards?.length, "first:", setResp.cards?.[0]?.card_info?.name, "id:", setResp.cards?.[0]?.id);

  // 5. Test of we via /search met "Ball Pattern" pokémon-cards van AH vinden
  for (const q of ["Ball Pattern Ascended", "Energy Pattern Ascended", "Ball Pattern Erika"]) {
    const r = await api(`/search?q=${encodeURIComponent(q)}&limit=10`);
    console.log(`\n--- /search?q=${q} → total ${r.total ?? 0} ---`);
    for (const item of (r.results || []).slice(0, 5)) {
      console.log(`  "${item.card_info?.name}" set="${item.card_info?.set_name}" #${item.card_info?.card_number}`);
    }
  }
})();
