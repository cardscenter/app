// Chunked trigger voor /api/cron/sync-pokewallet?limit=N op live.
//
// Roept de cron herhaaldelijk aan met een lage `limit` zodat elke call
// binnen Railway's 5-min HTTP timeout afgerond is — en de fire-and-forget
// stelt ons in staat om snel achter elkaar te triggeren zonder te wachten.
//
// Tussen calls polt 'ie Turso of er nog stale sets over zijn (via een
// directe DB-count i.p.v. de cron-response, want fire-and-forget geeft
// alleen status:"queued" terug).
//
// Gebruik:
//   CRON_SECRET=... npx tsx scripts/pw-chunked-sync.ts [limit=20] [wait-sec=180]
//
// Vereist: TURSO_AUTH_TOKEN in .env, CRON_SECRET als arg of env-var.

import "dotenv/config";
import { createClient } from "@libsql/client";

const LIVE_URL = "https://cardscenter.up.railway.app/api/cron/sync-pokewallet";
const TURSO_URL = "libsql://cardscenter-cardscenter.aws-eu-west-1.turso.io";
const MAX_CHUNKS = 30; // safety-cap

async function countStaleSets(client: ReturnType<typeof createClient>, hoursOld = 12): Promise<number> {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString();
  // Stale = sets zonder ENIGE card met recente priceUpdatedAt. Matcht
  // de server-route filter (`cards: { none: { priceUpdatedAt: gt cutoff } }`).
  // PokeWallet-unmatchable cards blokkeren een set NIET — zodra 1 card
  // in de set deze cycle gesynced is, telt 'ie als vers.
  const r = await client.execute({
    sql: `SELECT COUNT(*) AS n
          FROM CardSet cs
          WHERE cs.pokewalletSetId IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM Card c
              WHERE c.cardSetId = cs.id
                AND c.priceUpdatedAt > ?
            )`,
    args: [cutoff],
  });
  return Number(r.rows[0]?.n ?? 0);
}

async function triggerChunk(limit: number, secret: string): Promise<{ status: string; ms: number }> {
  const start = Date.now();
  const res = await fetch(`${LIVE_URL}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const ms = Date.now() - start;
  const body = await res.text();
  return { status: `HTTP ${res.status} — ${body.slice(0, 100)}`, ms };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args[0] ?? 20);
  const waitSec = Number(args[1] ?? 180);
  const secret = process.env.CRON_SECRET;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!secret) {
    console.error("❌ CRON_SECRET niet gezet (env-var of bij start meegeven).");
    process.exit(1);
  }
  if (!tursoToken) {
    console.error("❌ TURSO_AUTH_TOKEN niet in .env.");
    process.exit(1);
  }

  const client = createClient({ url: TURSO_URL, authToken: tursoToken });
  console.log(`Chunked sync — limit=${limit}, wachttijd ${waitSec}s tussen chunks`);

  let chunk = 0;
  while (chunk < MAX_CHUNKS) {
    chunk++;
    const staleBefore = await countStaleSets(client);
    if (staleBefore === 0) {
      console.log(`\n✅ Geen stale sets meer. Klaar na ${chunk - 1} chunks.`);
      break;
    }
    console.log(`\n[chunk ${chunk}/${MAX_CHUNKS}] Stale sets: ${staleBefore} — trigger…`);
    const t = await triggerChunk(limit, secret);
    console.log(`  → ${t.status} (${t.ms}ms)`);

    if (chunk >= MAX_CHUNKS) {
      console.log("⚠ MAX_CHUNKS bereikt zonder voltooiing — check admin/crons.");
      break;
    }

    console.log(`  ⏳ Wacht ${waitSec}s voor volgende chunk…`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
}

main().catch((e) => {
  console.error("❌ Chunk-runner faalde:", e);
  process.exit(1);
});
