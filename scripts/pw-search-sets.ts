import "dotenv/config";
import { listAllSets } from "../src/lib/pokewallet/client";

(async () => {
  const r = await listAllSets();
  const find = (re: RegExp, codeMatch?: string) =>
    r.data.filter(
      (s) => (re.test(s.name) || (codeMatch && s.set_code === codeMatch)) && (s.language === "eng" || s.language === null),
    );

  const log = (label: string, list: { set_id: string; set_code: string | null; name: string }[]) => {
    console.log(`\n${label}:`);
    for (const m of list) console.log(`  ${m.set_id.padEnd(8)} ${(m.set_code ?? "—").padEnd(10)} ${m.name}`);
  };

  log("SM Base", find(/sun.{0,3}moon.{0,8}base|^sm:\s*sun|^sm01|^sm 01|^sm\s+base/i, "SM01"));
  log("XY Base", find(/^xy:\s*xy|^xy01|^xy 01|^xy\s+base|^xy\s+\(/i, "XY"));
  log("Diamond & Pearl Base", find(/diamond.{0,4}pearl(?!.*galactic|.*storm|.*frontiers|.*great|.*mysterious|.*secret|.*majestic|.*rising|.*trinity|.*platinum)/i, "DP"));
  log("Nintendo Black Star (np)", find(/nintendo|^np:|^np 0|black\s*star\s*promos$/i));
  log("BW Black Star (bwp)", find(/^bwp|^bw:.*promo|black.{0,4}white.{0,4}promo/i, "BWP"));
  log("HGSS Black Star (hgssp)", find(/^hgssp|hgss.*promo/i, "HGSP"));
  log("DP Black Star (dpp)", find(/^dpp|^dp:.*promo|d&p.*promo/i, "DPP"));
  log("Pokemon GO (swsh10.5)", find(/pokemon\s*go\b|swsh10\.5|swsh\s*10\.5/i));
  log("McDonald's collections", find(/mcdonald|happy\s*meal/i));
  log("Pokemon Futsal", find(/futsal|fut\s*2020/i));
  log("Pokemon Rumble", find(/^rumble$|pokemon\s*rumble/i, "RUM"));
  log("SWSH promos", find(/sword.{0,4}shield.{0,5}promo|^swsh:.*promo/i));
  log("XY promos", find(/xy.*promo/i));
  log("BW promos", find(/black.{0,4}white.*promo|^bw.*promo|^bw:.*promo/i));
  log("DP promos", find(/diamond.{0,4}pearl.*promo|^dp.*promo/i));
  log("Ruby & Sapphire", find(/ruby.{0,4}sapphire/i));
  log("McD 2021", find(/mcdonald.*2021|mcd.*21|happy meal 2021/i));
  log("Best of game", find(/best of game/i));
})();
