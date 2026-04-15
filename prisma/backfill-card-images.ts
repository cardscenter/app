import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Backfill Card.imageUrlFull from pokemontcg.io for any card that TCGdex has
// no image for. We match our local CardSet to a pokemontcg.io set by name,
// then try `https://images.pokemontcg.io/{ptcgoSetId}/{localId}` — if the
// _hires.png variant returns 200, we persist the base URL.
//
// Coverage is ~44% of the ~1200 missing-image cards; the rest are mostly
// Japanese-only sets and very-recent promo sets pokemontcg.io doesn't have.
//
// Run: `npx tsx prisma/backfill-card-images.ts`

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// A few explicit overrides for sets whose names differ between TCGdex and
// pokemontcg.io. Add as they show up.
const MANUAL_SET_MAP: Record<string, string> = {
  "tk-bw-z": "bwt-z",       // not in ptcgio actually — left as example
};

interface PtcgSet {
  id: string;
  name: string;
  ptcgoCode?: string;
  releaseDate?: string;
}

async function fetchPtcgSets(): Promise<PtcgSet[]> {
  const res = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=250");
  if (!res.ok) throw new Error(`ptcgio sets fetch failed: ${res.status}`);
  const { data } = await res.json() as { data: PtcgSet[] };
  return data;
}

async function probeImage(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔎 Fetching pokemontcg.io set catalog...");
  const ptcgSets = await fetchPtcgSets();
  console.log(`   got ${ptcgSets.length} sets`);

  const byName = new Map<string, PtcgSet>();
  for (const s of ptcgSets) byName.set(norm(s.name), s);

  // Cards needing a fallback image: no imageUrl AND no imageUrlFull yet
  const cards = await prisma.card.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: "" }],
      imageUrlFull: null,
    },
    select: {
      id: true,
      localId: true,
      name: true,
      cardSet: {
        select: { name: true, tcgdexSetId: true },
      },
    },
  });

  console.log(`🃏 ${cards.length} cards missing an image, trying pokemontcg.io fallback...\n`);

  // Group by set to avoid redundant lookups
  const byTcgSet = new Map<string, typeof cards>();
  for (const c of cards) {
    const k = c.cardSet.tcgdexSetId ?? "";
    if (!byTcgSet.has(k)) byTcgSet.set(k, []);
    byTcgSet.get(k)!.push(c);
  }

  let resolved = 0;
  let probed = 0;
  let skippedSets = 0;

  for (const [tcgSetId, setCards] of byTcgSet) {
    const setName = setCards[0]?.cardSet.name ?? "?";
    let ptcgSet = byName.get(norm(setName));
    if (!ptcgSet && MANUAL_SET_MAP[tcgSetId]) {
      ptcgSet = ptcgSets.find((s) => s.id === MANUAL_SET_MAP[tcgSetId]);
    }

    if (!ptcgSet) {
      skippedSets++;
      continue;
    }

    console.log(`→ ${setName} (tcgdex:${tcgSetId} → ptcgio:${ptcgSet.id})  ${setCards.length} cards`);

    for (const c of setCards) {
      // pokemontcg.io uses numeric-like localIds; TCGdex often has leading
      // zeros ("001"). Try a few variants.
      const candidates = new Set<string>();
      candidates.add(c.localId);
      candidates.add(c.localId.replace(/^0+/, ""));        // strip leading zeros
      candidates.add(String(parseInt(c.localId, 10) || c.localId));

      let found: string | null = null;
      for (const cand of candidates) {
        if (!cand) continue;
        const base = `https://images.pokemontcg.io/${ptcgSet.id}/${cand}`;
        probed++;
        const ok = await probeImage(`${base}_hires.png`);
        await sleep(DELAY_MS);
        if (ok) {
          found = base;
          break;
        }
      }

      if (found) {
        await prisma.card.update({
          where: { id: c.id },
          data: { imageUrlFull: found },
        });
        resolved++;
        if (resolved % 25 === 0) console.log(`   ✓ ${resolved} resolved…`);
      }
    }
  }

  console.log(`\n✅ Done. Resolved ${resolved}/${cards.length} (${probed} probes, ${skippedSets} sets skipped).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
