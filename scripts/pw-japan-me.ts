// Probeer Japanese ME-sets — daar zaten de Pattern variants voor 151 ook in
// (sv2a JAPAN) ipv de Engelse versie. Wellicht zit AH's variants ook in JAP.
import "dotenv/config";
import { listAllSets } from "../src/lib/pokewallet/client";
const KEY = process.env.POKEWALLET_API_KEY!;
async function api(p: string) {
  const r = await fetch(`https://api.pokewallet.io${p}`, { headers: { "X-API-Key": KEY } });
  try { return await r.json(); } catch { return null; }
}

(async () => {
  const list = await listAllSets();

  // Vind alle Japanese sets gerelateerd aan ME / Mega Evolution / Ascended
  const jap = list.data.filter(
    (s) =>
      s.language === "jap" &&
      (/mega|ascended|ME0?2|スカ?ーレット|ヘ|ME ?\d|Heroes/i.test(s.name) ||
        /M3|M4|ME|JM|MEH/i.test(s.set_code ?? "")),
  );
  console.log(`Japanese ME-related sets: ${jap.length}`);
  for (const s of jap) {
    console.log(`  ${s.set_id.padStart(6)} ${(s.set_code ?? "—").padEnd(8)} cards=${s.card_count} ${s.release_date} "${s.name}"`);
  }

  // 24600 = M3: Nihil Zero (Japanese release jan 2026 — direct equivalent of ME02 Ascended Heroes?)
  // Laten we deze inspecteren
  console.log("\n=== /sets/24600 (M3: Nihil Zero — Japans release jan 2026) ===");
  const m3 = await api("/sets/24600?limit=200");
  console.log("Total cards in cards[]:", m3.cards?.length);
  console.log("set total_cards:", m3.set?.total_cards);
  // Toon namen die op variants lijken
  const variants = (m3.cards ?? []).filter((c: { card_info: { name: string } }) =>
    /\(.*Pattern.*\)|\(.*Reverse.*\)|\(Ball|\(Energy/i.test(c.card_info.name),
  );
  console.log(`Variants in M3: ${variants.length}`);
  for (const v of variants.slice(0, 10)) console.log(`  "${v.card_info.name}" #${v.card_info.card_number}`);

  // Zoek alle ME / ME02 / "M2" Japanese sets
  console.log("\n=== Alle JAP-sets met M2 of nihil ===");
  const m2 = list.data.filter((s) =>
    (/^m2$|m2[ \-:]|nihil|ascended|m02/i.test(s.set_code ?? "") || /^M2|nihil/i.test(s.name ?? "")) && s.language === "jap",
  );
  for (const s of m2) {
    console.log(`  ${s.set_id.padStart(6)} ${s.set_code} cards=${s.card_count} "${s.name}"`);
  }

  // Zoek ALLE jap sets met release_date februari / maart 2026 (= post-ME02 release)
  console.log("\n=== Alle JAP-sets jan/feb/mrt 2026 ===");
  const earlySets = list.data.filter(
    (s) => s.language === "jap" && /2026/.test(s.release_date ?? ""),
  );
  for (const s of earlySets) {
    console.log(`  ${s.set_id.padStart(6)} ${(s.set_code ?? "—").padEnd(10)} cards=${s.card_count} ${s.release_date} "${s.name}"`);
  }

  // Probeer ook de fully nieuwe ME-era english sets — wellicht heeft pokewallet
  // variants in een ander english set toegevoegd
  console.log("\n=== Alle ENG-sets jan/feb/mrt 2026 ===");
  const earlyEng = list.data.filter(
    (s) => s.language === "eng" && /2026/.test(s.release_date ?? ""),
  );
  for (const s of earlyEng) {
    console.log(`  ${s.set_id.padStart(6)} ${(s.set_code ?? "—").padEnd(10)} cards=${s.card_count} ${s.release_date} "${s.name}"`);
  }
})();
