import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return { status: r.status, body: await r.json() };
}
(async () => {
  // Test wat in negative set-ids zit
  for (const id of ["-233", "-230", "-235"]) {
    console.log(`\n=== /sets/${id} ===`);
    const r = await api(`/sets/${encodeURIComponent(id)}?limit=20`);
    console.log("status:", r.status);
    const cards = r.body.cards ?? [];
    console.log(`cards: ${cards.length}`);
    for (const c of cards.slice(0, 5)) {
      console.log(`  "${c.card_info?.name}" #${c.card_info?.card_number}`);
    }
  }

  // MEE: Mega Evolution Energies
  console.log(`\n=== /sets/24461 (Mega Evolution Energies) ===`);
  const r = await api(`/sets/24461?limit=50`);
  console.log("cards:", r.body.cards?.length);
  for (const c of (r.body.cards ?? []).slice(0, 20)) {
    console.log(`  "${c.card_info?.name}" #${c.card_info?.card_number}`);
  }

  // ME01 Mega Evolution: 318 cards. Onze ME01 set heeft hoeveel?
  console.log(`\n=== /sets/24380 (ME01) — kijk of er hier ook (Pattern) cards in zitten ===`);
  for (const page of [1, 2]) {
    const r = await api(`/sets/24380?limit=200&page=${page}`);
    const cards = r.body.cards ?? [];
    const variants = cards.filter((c: { card_info?: { name?: string } }) =>
      /\(.*Pattern.*\)|\(.*Reverse.*\)|\(.*Holo.*\)|\(Ball|\(Energy/i.test(c.card_info?.name ?? ""),
    );
    console.log(`  page ${page}: ${cards.length} cards, ${variants.length} met variant-suffix`);
    for (const v of variants.slice(0, 10)) console.log(`    "${v.card_info?.name}" #${v.card_info?.card_number}`);
  }

  // ME03 Perfect Order
  console.log(`\n=== /sets/24587 (ME03) — kijk of er Pattern cards in zitten ===`);
  for (const page of [1, 2]) {
    const r = await api(`/sets/24587?limit=200&page=${page}`);
    const cards = r.body.cards ?? [];
    const variants = cards.filter((c: { card_info?: { name?: string } }) =>
      /\(.*Pattern.*\)|\(.*Reverse.*\)|\(.*Holo.*\)|\(Ball|\(Energy/i.test(c.card_info?.name ?? ""),
    );
    console.log(`  page ${page}: ${cards.length} cards, ${variants.length} met variant-suffix`);
    for (const v of variants.slice(0, 10)) console.log(`    "${v.card_info?.name}" #${v.card_info?.card_number}`);
  }
})();
