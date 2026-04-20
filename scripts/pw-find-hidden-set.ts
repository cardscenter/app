// Last-resort: kijk of de Ball/Energy variants in een ANDERE pokewallet-set
// zitten (bv "ASC Variants", "Ascended Patterns"), of via card-number ranges.
import "dotenv/config";
import { listAllSets } from "../src/lib/pokewallet/client";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(path: string) {
  const r = await fetch(`https://api.pokewallet.io${path}`, { headers: { "X-API-Key": KEY } });
  return await r.json();
}
(async () => {
  // 1. ALLE pokewallet sets
  const list = await listAllSets();
  console.log(`Total sets in pokewallet: ${list.data.length}`);

  // Zoek alle sets met card_count rond de 163 (= verschil 470-307) of variants in name
  const interesting = list.data.filter(
    (s) =>
      Math.abs((s.card_count ?? 0) - 163) < 30 ||
      /reverse|variant|pattern|holo|altern/i.test(s.name) ||
      /asc[a-z]*p|asc[a-z]*v|asc[a-z]*b|asc[a-z]*e/i.test(s.set_code ?? ""),
  );
  console.log(`\nPotentially interesting sets: ${interesting.length}`);
  for (const s of interesting.slice(0, 30)) {
    console.log(`  ${s.set_id.padEnd(8)} ${(s.set_code ?? "—").padEnd(10)} cards=${(s.card_count ?? 0).toString().padStart(4)} "${s.name}"`);
  }

  // 2. Toon ALLE sets met "Reverse Holo" of "Pattern" in name
  console.log(`\nSets met Reverse/Pattern in name:`);
  for (const s of list.data.filter((s) => /reverse|pattern/i.test(s.name))) {
    console.log(`  ${s.set_id.padEnd(8)} cards=${s.card_count} "${s.name}"`);
  }

  // 3. Check sets die release-date rond 30 januari 2026 hebben (= AH release)
  console.log(`\nSets met release in jan-feb 2026:`);
  for (const s of list.data.filter((s) => /2026/.test(s.release_date ?? ""))) {
    console.log(`  ${s.set_id.padEnd(8)} ${(s.set_code ?? "—").padEnd(10)} cards=${s.card_count} ${s.release_date} "${s.name}"`);
  }

  // 4. Als laatste: probeer set_id-naburigen van 24541 (24540, 24542, 24543, ..)
  console.log(`\nSet_ids rond 24541 (24535-24550):`);
  for (let id = 24535; id <= 24550; id++) {
    const found = list.data.find((s) => s.set_id === String(id));
    if (found) {
      console.log(`  ${id}: "${found.name}" cards=${found.card_count} code=${found.set_code} lang=${found.language}`);
    } else {
      console.log(`  ${id}: (not in list)`);
    }
  }
})();
