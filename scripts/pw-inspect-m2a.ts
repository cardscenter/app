// Inspect Japanse M2a set (629 cards) — wellicht bevat dit Ball/Energy variants.
import "dotenv/config";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(p: string) {
  const r = await fetch(`https://api.pokewallet.io${p}`, { headers: { "X-API-Key": KEY } });
  try { return await r.json(); } catch { return null; }
}

(async () => {
  // M2a paginate alle pagina's
  const allCards: { name: string; number: string; pwId: string }[] = [];
  for (let p = 1; p <= 10; p++) {
    const r = await api(`/sets/24499?limit=200&page=${p}`);
    const cards = (r.cards ?? []) as Array<{ id: string; card_info: { name: string; card_number: string } }>;
    if (cards.length === 0) break;
    for (const c of cards) {
      allCards.push({ name: c.card_info.name, number: c.card_info.card_number ?? "?", pwId: c.id });
    }
    console.log(`page ${p}: ${cards.length} cards (total so far: ${allCards.length})`);
    if (cards.length < 200) break;
  }

  // Tel naam-suffixen
  const suffixCounts = new Map<string, number>();
  for (const c of allCards) {
    const m = c.name.match(/\(([^)]+)\)|\[([^\]]+)\]| - \d+\/\d+/);
    const suffix = m ? (m[1] ?? m[2] ?? "_alt-art-num_") : "_no-suffix_";
    suffixCounts.set(suffix, (suffixCounts.get(suffix) ?? 0) + 1);
  }
  console.log(`\nSuffix tellingen (top 20):`);
  for (const [s, n] of [...suffixCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  "${s}": ${n}x`);
  }

  // Variants met Ball/Energy/Pattern/Reverse
  const variants = allCards.filter((c) => /\(.*Pattern.*\)|\(.*Reverse.*\)|\(Ball|\(Energy|\(Master|\(Poke/i.test(c.name));
  console.log(`\nVariants met Ball/Energy/Pattern/Reverse/Master/Poke: ${variants.length}`);
  for (const v of variants.slice(0, 15)) console.log(`  "${v.name}" #${v.number}`);

  // Pikachu/Erika in M2a?
  const pika = allCards.filter((c) => /Pikachu|Erika.*Oddish|Tangela/i.test(c.name));
  console.log(`\nPikachu/Erika/Tangela in M2a: ${pika.length}`);
  for (const c of pika.slice(0, 10)) console.log(`  "${c.name}" #${c.number}`);

  // Voor M2 (24459) ook even
  console.log("\n\n=== M2: Inferno X (24459) ===");
  const m2 = await api("/sets/24459?limit=200");
  const m2cards = (m2.cards ?? []) as Array<{ card_info: { name: string; card_number: string } }>;
  console.log(`Total: ${m2cards.length}`);
  const m2variants = m2cards.filter((c) => /\(.*Pattern.*\)|\(.*Reverse.*\)|\(Ball|\(Energy/i.test(c.card_info.name));
  console.log(`Met variants: ${m2variants.length}`);
  for (const v of m2variants.slice(0, 10)) console.log(`  "${v.card_info.name}" #${v.card_info.card_number}`);
})();
