// Eenmalige backfill van het snapshot-gat 5-7 juli 2026 (Turso-IP-block-storing).
// Per kaart met een snapshot op ZOWEL 4 juli als 8 juli worden 3 tussenliggende
// punten geschreven via lineaire interpolatie (f = 1/4, 2/4, 3/4) — een stijgende
// of dalende lijn dus, geen 3 identieke prijzen.
//
// Veiligheid (zie bulk-job-regels):
//  - foreground, eindigt vanzelf; --limit=N voor een testrun
//  - gebatchte writes (100 per transactie), pauze tussen batches
//  - health-gate op de live site vóór start en elke 25 batches
//  - idempotent: deterministische id's (bkfl-<cardId>-<dag>) + INSERT OR IGNORE
//    + unique(cardId, date) — herdraaien is altijd veilig
//
// Aanroep:  npx tsx scripts/backfill-price-gap.ts [--limit=50] [--apply]
// Zonder --apply draait 'ie dry-run (toont wat er geschreven zou worden).

import { createClient } from "@libsql/client";
import "dotenv/config";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

const HEALTH_URL = "https://cardscenter.up.railway.app/api/cards/search?q=pikachu";
const HEALTH_MAX_MS = 4000;
const BATCH_SIZE = 100;      // inserts per transactie
const BATCH_SLEEP_MS = 150;
const HEALTH_EVERY = 25;     // health-check elke N batches
const FETCH_CHUNK = 5000;

const D4_START = "2026-07-04", D4_END = "2026-07-05";
const D8_START = "2026-07-08", D8_END = "2026-07-09";
const GAP_DAYS = ["2026-07-05", "2026-07-06", "2026-07-07"];

const db = createClient({
  url: "libsql://cardscenter-cardscenter.turso.io", // Fly-edge: geïsoleerd van de app (AWS-hostname)
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function assertLiveHealthy(): Promise<void> {
  const t0 = Date.now();
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - t0;
    if (res.status !== 200 || ms > HEALTH_MAX_MS) {
      console.error(`ABORT: live health-gate faalde (HTTP ${res.status} in ${ms}ms)`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`ABORT: live health-gate onbereikbaar:`, e);
    process.exit(1);
  }
}

interface Pair { cardId: string; n4: number | null; r4: number | null; n8: number | null; r8: number | null }

async function fetchPairs(): Promise<Pair[]> {
  const pairs: Pair[] = [];
  let offset = 0;
  for (;;) {
    const res = await db.execute({
      sql: `SELECT a.cardId, a.priceNormal as n4, a.priceReverse as r4,
                   b.priceNormal as n8, b.priceReverse as r8
            FROM CardPriceHistory a
            JOIN CardPriceHistory b ON b.cardId = a.cardId AND b.date >= ? AND b.date < ?
            WHERE a.date >= ? AND a.date < ?
            ORDER BY a.cardId LIMIT ? OFFSET ?`,
      args: [D8_START, D8_END, D4_START, D4_END, FETCH_CHUNK, offset],
    });
    for (const r of res.rows) {
      pairs.push({
        cardId: String(r.cardId),
        n4: r.n4 == null ? null : Number(r.n4),
        r4: r.r4 == null ? null : Number(r.r4),
        n8: r.n8 == null ? null : Number(r.n8),
        r8: r.r8 == null ? null : Number(r.r8),
      });
    }
    if (res.rows.length < FETCH_CHUNK) break;
    offset += FETCH_CHUNK;
    await sleep(200);
  }
  return pairs;
}

const lerp = (a: number | null, b: number | null, f: number): number | null =>
  a != null && a > 0 && b != null && b > 0 ? Math.round((a + (b - a) * f) * 100) / 100 : null;

async function main() {
  console.log(`Backfill 5-7 juli — ${APPLY ? "APPLY" : "DRY-RUN"}${LIMIT !== Infinity ? ` (limit ${LIMIT} kaarten)` : ""}`);
  await assertLiveHealthy();

  const pairs = (await fetchPairs()).slice(0, LIMIT === Infinity ? undefined : LIMIT);
  console.log(`${pairs.length} kaarten met snapshots op 4 én 8 juli`);

  const createdAt = new Date().toISOString().replace("Z", "+00:00");
  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  for (const p of pairs) {
    for (let d = 0; d < 3; d++) {
      const f = (d + 1) / 4;
      const n = lerp(p.n4, p.n8, f);
      const r = lerp(p.r4, p.r8, f);
      if (n == null && r == null) continue;
      stmts.push({
        sql: `INSERT OR IGNORE INTO CardPriceHistory (id, cardId, date, priceNormal, priceReverse, createdAt)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          `bkfl-${p.cardId}-${GAP_DAYS[d]}`,
          p.cardId,
          `${GAP_DAYS[d]}T00:00:00.000+00:00`,
          n, r, createdAt,
        ],
      });
    }
  }
  console.log(`${stmts.length} rijen te schrijven`);

  if (!APPLY) {
    for (const s of stmts.slice(0, 9)) console.log("  voorbeeld:", JSON.stringify(s.args));
    console.log("Dry-run klaar — draai met --apply om te schrijven.");
    return;
  }

  let written = 0;
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const batchNo = i / BATCH_SIZE;
    if (batchNo > 0 && batchNo % HEALTH_EVERY === 0) {
      await assertLiveHealthy();
      console.log(`  health OK · ${written}/${stmts.length}`);
    }
    await db.batch(stmts.slice(i, i + BATCH_SIZE), "write");
    written += Math.min(BATCH_SIZE, stmts.length - i);
    await sleep(BATCH_SLEEP_MS);
  }
  console.log(`Klaar: ${written} rijen geschreven (INSERT OR IGNORE — bestaande rijen ongemoeid).`);

  const check = await db.execute({
    sql: `SELECT substr(date, 1, 10) as day, COUNT(*) as n FROM CardPriceHistory
          WHERE date >= ? AND date < ? GROUP BY day ORDER BY day`,
    args: [D4_START, D8_END],
  });
  for (const r of check.rows) console.log(`  ${r.day}: ${r.n} snapshots`);
}

main();
