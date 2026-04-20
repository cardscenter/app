import "dotenv/config";
import { listAllSets } from "../src/lib/pokewallet/client";

(async () => {
  const r = await listAllSets();
  const candidates = r.data.filter(
    (s) =>
      /ascended|heroes|ME[0-9]?\.?5|^ASC/i.test(s.name) ||
      (s.set_code && /^ASC|^ME/i.test(s.set_code)) ||
      s.name.toLowerCase().includes("ascended") ||
      s.name.toLowerCase().includes("ball pattern") ||
      s.name.toLowerCase().includes("energy reverse"),
  );
  console.log(`Total possibly-related: ${candidates.length}`);
  for (const s of candidates) {
    console.log(`  ${s.set_id.padEnd(8)} ${(s.set_code ?? "—").padEnd(10)} lang=${(s.language ?? "—").padEnd(4)} "${s.name}"  (${s.card_count ?? "?"} cards)`);
  }

  // Ook even alle me-sets
  console.log("\nAlle ME-sets (Mega Evolution era):");
  const me = r.data.filter((s) => /^me|mega evolution/i.test(s.name) || s.set_code?.startsWith("ME"));
  for (const s of me) {
    console.log(`  ${s.set_id.padEnd(8)} ${(s.set_code ?? "—").padEnd(10)} lang=${(s.language ?? "—").padEnd(4)} "${s.name}"  (${s.card_count ?? "?"} cards)`);
  }
})();
