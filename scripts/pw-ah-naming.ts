import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return await r.json();
}
(async () => {
  // 1. ALL AH-records via paginated /sets om naar special naming te zoeken
  const allCards: { name: string; number: string }[] = [];
  for (let p = 1; p <= 5; p++) {
    const r = await api(`/sets/24541?limit=200&page=${p}`);
    const cards = r.cards || [];
    if (cards.length === 0) break;
    for (const c of cards) {
      allCards.push({ name: c.card_info?.name ?? "?", number: c.card_info?.card_number ?? "?" });
    }
    if (p >= (r.pagination?.total_pages ?? 1)) break;
  }
  console.log(`Totaal AH cards via /sets: ${allCards.length}`);

  // Zoek alle namen met ( ) [ ] of speciale termen
  const special = allCards.filter((c) => /[()[\]]|reverse|pattern|finish/i.test(c.name));
  console.log(`Met parens/brackets/reverse/pattern/finish: ${special.length}`);
  for (const s of special.slice(0, 20)) console.log(`  "${s.name}" #${s.number}`);

  // Onderscheid in card_number (sommige zijn 264/217 = duidelijk extra varianten)
  const extraNum = allCards.filter((c) => {
    const m = c.number.match(/^(\d+)\/(\d+)$/);
    if (!m) return false;
    return parseInt(m[1]) > parseInt(m[2]);
  });
  console.log(`\nCards met card_number > totaal (= secret rare ranges): ${extraNum.length}`);
  for (const c of extraNum.slice(0, 25)) console.log(`  "${c.name}" #${c.number}`);
})();
