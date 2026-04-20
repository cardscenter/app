import "dotenv/config";
import { listAllSets } from "../src/lib/pokewallet/client";
(async () => {
  const r = await listAllSets();
  const filtered = r.data.filter(
    (s) =>
      /asc|ascend|me\s*0?2\.5|^ME[ :]|extended art|reverse only|holo only|special print/i.test(s.name) ||
      /^x?ASC|^x?ME/i.test(s.set_code ?? ""),
  );
  console.log(`Total filtered: ${filtered.length}`);
  for (const s of filtered) {
    console.log(
      `  ${s.set_id.padStart(6)} ${(s.set_code ?? "—").padEnd(14)} cards=${(s.card_count ?? 0).toString().padStart(4)} lang=${s.language ?? "—"} "${s.name}"`,
    );
  }
})();
