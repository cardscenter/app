import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// v2 image backfill — uses the same 3-step resolver as our live gameplay/
// pricing fallback (id-as-is → transformed-id → name+set search).
//
// Same pokemontcg.io source as the first pass; just smarter matching.
// Idempotent: only updates cards that still lack both imageUrl + imageUrlFull.

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const DELAY_MS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPtcgById(id: string) {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { data } = await res.json() as { data?: { id: string; images?: { large?: string; small?: string } } };
    return data ?? null;
  } catch { return null; }
}

async function searchPtcg(query: string) {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=1`);
    if (!res.ok) return null;
    const { data } = await res.json() as { data?: { id: string; images?: { large?: string; small?: string } }[] };
    return data?.[0] ?? null;
  } catch { return null; }
}

function transformId(tcgdexCardId: string): string {
  const idx = tcgdexCardId.lastIndexOf("-");
  if (idx < 0) return tcgdexCardId;
  let setPart = tcgdexCardId.slice(0, idx);
  const localPart = tcgdexCardId.slice(idx + 1);
  setPart = setPart.replace(/\./g, "").replace(/([a-zA-Z])0+(\d)/g, "$1$2");
  const cleanLocal = localPart.replace(/^0+(?=\d)/, "");
  return `${setPart}-${cleanLocal}`;
}

function q(v: string): string {
  return v.replace(/"/g, '\\"');
}

async function resolveCard(args: {
  tcgdexId: string;
  name: string;
  setName: string;
  localId: string;
}) {
  // 1. id as-is
  let c = await fetchPtcgById(args.tcgdexId);
  if (c) return c;
  // 2. transformed
  const tId = transformId(args.tcgdexId);
  if (tId !== args.tcgdexId) {
    c = await fetchPtcgById(tId);
    if (c) return c;
  }
  // 3. name + set + number search
  const number = args.localId.replace(/^0+(?=\d)/, "");
  c = await searchPtcg(`name:"${q(args.name)}" set.name:"${q(args.setName)}" number:${number}`);
  return c;
}

async function main() {
  const missing = await prisma.card.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: "" }],
      imageUrlFull: null,
    },
    select: {
      id: true, name: true, localId: true,
      cardSet: { select: { name: true } },
    },
  });

  console.log(`🔎 ${missing.length} cards still missing images, running v2 resolver…\n`);

  let found = 0;
  let notFound = 0;

  for (const c of missing) {
    const ptcg = await resolveCard({
      tcgdexId: c.id,
      name: c.name,
      setName: c.cardSet.name,
      localId: c.localId,
    });
    await sleep(DELAY_MS);

    // pokemontcg.io images look like "https://images.pokemontcg.io/sm35/1_hires.png"
    // We store the base "https://images.pokemontcg.io/sm35/1" so `getCardImageUrl()`
    // can append _hires.png or .png based on quality.
    const large = ptcg?.images?.large;
    if (!large) { notFound++; continue; }

    // Derive the base URL (strip _hires.png / .png)
    const base = large.replace(/(_hires)?\.(png|jpg|webp)$/i, "");

    await prisma.card.update({
      where: { id: c.id },
      data: { imageUrlFull: base },
    });
    found++;
    if (found % 20 === 0) console.log(`  ✓ ${found} resolved…`);
  }

  console.log(`\n✅ v2 backfill done: ${found}/${missing.length} resolved (${notFound} not on pokemontcg.io).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
