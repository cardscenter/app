// Bulk-backfill: mirror kaart- en set-afbeeldingen van PokeWallet naar R2/schijf.
//
// GEHARDE VERSIE na het incident van 2026-07-04 (backfill-storm → Turso-IP-block
// op Railway → site 3 dagen down). Veiligheidsmaatregelen in dit script:
//   1. Harde limieten — default 50 kaarten/run, max 1000. Geen ∞ meer; elke run
//      eindigt vanzelf binnen minuten (foreground draaien, nooit detached).
//   2. Gebatchte DB-writes — één $transaction per ~25 updates i.p.v. één
//      update per kaart. Minimale schrijfdruk op Turso.
//   3. Health-gate — bij een remote DATABASE_URL wordt vóór elke batch de live
//      site gecheckt (/api/cards/search). Faalt die of is 'ie traag (>4s), dan
//      stopt het script ONMIDDELLIJK.
//   4. Lockfile — twee gelijktijdige runs zijn onmogelijk.
//   5. Edge-isolatie — draai live-runs via de REGIO-LOZE hostname (Fly-edge)
//      zodat script-verkeer een ander Turso-edge raakt dan de live-app (AWS):
//      DATABASE_URL="libsql://cardscenter-cardscenter.turso.io"
//
// Gebruik (altijd foreground, nooit met & of achtergrond-runner):
//   npx tsx scripts/pw-mirror-images.ts                      # 50 kaarten (default)
//   npx tsx scripts/pw-mirror-images.ts --limit=25 --only=cards
//   npx tsx scripts/pw-mirror-images.ts --only=logos
//   DATABASE_URL="libsql://cardscenter-cardscenter.turso.io" npx tsx scripts/pw-mirror-images.ts --limit=100
//
// Vlaggen:
//   --only=cards|logos|both   (default both)
//   --limit=N                 kaarten deze run (default 50, max 1000)
//   --cursor=<Card.id>        start vanaf id > cursor (om hardnekkige falers te passeren)
//   --concurrency=N           parallelle fetches per batch (default 2, max 4)
//   --sleep=MS                pauze tussen fetch-batches (default 1500, min 250)
//   --health-url=URL          override health-endpoint (voor tests)

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { isR2Configured } from "../src/lib/r2";
import {
  mirrorCardImage,
  mirrorSetLogo,
  mapPaced,
} from "../src/lib/pokewallet/mirror-images";

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 1000;
const DB_WRITE_BATCH = 25; // updates per $transaction
const LOCKFILE = join(process.cwd(), "scripts", ".pw-mirror-images.lock");
const LOCK_STALE_MS = 2 * 60 * 60 * 1000; // 2u
const HEALTH_URL_DEFAULT = "https://cardscenter.up.railway.app/api/cards/search?q=pikachu";
const HEALTH_MAX_MS = 4000;

function arg(name: string, def: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

// ── Lockfile: nooit twee runs tegelijk ──────────────────────────────────────
function acquireLock(): void {
  if (existsSync(LOCKFILE)) {
    try {
      const [pid, iso] = readFileSync(LOCKFILE, "utf8").trim().split(" ");
      const age = Date.now() - Date.parse(iso ?? "");
      if (Number.isFinite(age) && age < LOCK_STALE_MS) {
        console.error(
          `✗ GEWEIGERD: er lijkt al een mirror-run te lopen (lockfile van pid ${pid}, ` +
            `${Math.round(age / 60000)} min oud). Wacht tot die klaar is, of verwijder ` +
            `${LOCKFILE} als je ZEKER weet dat er geen run meer draait.`,
        );
        process.exit(1);
      }
      console.log(`(stale lockfile van ${iso} genegeerd — ouder dan 2u)`);
    } catch {
      /* onleesbaar → overschrijven */
    }
  }
  writeFileSync(LOCKFILE, `${process.pid} ${new Date().toISOString()}`);
}

function releaseLock(): void {
  try {
    unlinkSync(LOCKFILE);
  } catch {
    /* al weg */
  }
}

// ── Health-gate: stop zodra de live site hapert ─────────────────────────────
const isRemoteDb = (process.env.DATABASE_URL ?? "").startsWith("libsql://");

async function assertLiveHealthy(healthUrl: string): Promise<void> {
  const t0 = Date.now();
  let status = 0;
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
    status = res.status;
    await res.arrayBuffer(); // hele body — meet de échte responstijd
  } catch {
    status = 0;
  }
  const ms = Date.now() - t0;
  if (status !== 200 || ms > HEALTH_MAX_MS) {
    console.error(
      `\n✗ HEALTH-GATE: live site antwoordt niet gezond (HTTP ${status} in ${ms}ms, ` +
        `grens: 200 binnen ${HEALTH_MAX_MS}ms). Run ONMIDDELLIJK gestopt — ` +
        `geen verdere calls of writes. Check de site voordat je opnieuw draait.`,
    );
    releaseLock();
    process.exit(1);
  }
  console.log(`  health-gate ok (HTTP ${status} in ${ms}ms)`);
}

// ── Gebatchte DB-writes ─────────────────────────────────────────────────────
async function writeCardStems(pairs: { id: string; stem: string }[]): Promise<void> {
  for (let i = 0; i < pairs.length; i += DB_WRITE_BATCH) {
    const batch = pairs.slice(i, i + DB_WRITE_BATCH);
    await prisma.$transaction(
      batch.map((p) =>
        prisma.card.update({ where: { id: p.id }, data: { imageMirrorKey: p.stem } }),
      ),
    );
  }
}

async function writeLogoStems(pairs: { id: string; stem: string }[]): Promise<void> {
  for (let i = 0; i < pairs.length; i += DB_WRITE_BATCH) {
    const batch = pairs.slice(i, i + DB_WRITE_BATCH);
    await prisma.$transaction(
      batch.map((p) =>
        prisma.cardSet.update({ where: { id: p.id }, data: { logoMirrorKey: p.stem } }),
      ),
    );
  }
}

async function main() {
  const only = arg("only", "both"); // cards | logos | both
  const limit = Math.min(
    Math.max(1, parseInt(arg("limit", String(LIMIT_DEFAULT)), 10) || LIMIT_DEFAULT),
    LIMIT_MAX,
  );
  const startCursor = arg("cursor", "");
  const concurrency = Math.max(1, Math.min(4, parseInt(arg("concurrency", "2"), 10) || 2));
  const sleepMs = Math.max(250, parseInt(arg("sleep", "1500"), 10) || 1500);
  const healthUrl = arg("health-url", HEALTH_URL_DEFAULT);
  // Fetch-batches van beperkte grootte zodat de health-gate regelmatig checkt.
  const FETCH_CHUNK = 25;

  acquireLock();

  console.log(
    `Doel-opslag: ${isR2Configured() ? "R2" : "lokale schijf (public/uploads)"} · ` +
      `DB: ${isRemoteDb ? `REMOTE (${(process.env.DATABASE_URL ?? "").slice(0, 55)}…)` : "lokaal (dev.db)"}`,
  );
  console.log(
    `only=${only} limit=${limit} cursor=${startCursor || "(begin)"} ` +
      `concurrency=${concurrency} sleep=${sleepMs}ms · health-gate: ${isRemoteDb ? "AAN" : "uit (lokale DB)"}\n`,
  );

  // Eerste gate vóór welke DB-query dan ook — een ongezonde site betekent
  // meteen stoppen, nog vóór we ook maar één read doen.
  if (isRemoteDb) await assertLiveHealthy(healthUrl);

  const startedAt = Date.now();
  let mirroredCards = 0;
  let failedCards = 0;
  let mirroredLogos = 0;

  if (only === "cards" || only === "both") {
    const todo = await prisma.card.count({
      where: { pokewalletId: { not: null }, imageMirrorKey: null },
    });
    console.log(`Kaarten zonder mirror: ${todo} — deze run doet er max ${limit}\n`);

    let lastId = startCursor;
    let processed = 0;
    while (processed < limit) {
      if (isRemoteDb) await assertLiveHealthy(healthUrl);

      const take = Math.min(FETCH_CHUNK, limit - processed);
      const cards = await prisma.card.findMany({
        where: {
          pokewalletId: { not: null },
          imageMirrorKey: null,
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true, pokewalletId: true },
        orderBy: { id: "asc" },
        take,
      });
      if (cards.length === 0) break;

      // 1) beelden ophalen + naar R2 (raakt de DB niet)
      const done: { id: string; stem: string }[] = [];
      await mapPaced(
        cards,
        async (c) => {
          const stem = await mirrorCardImage(c);
          if (stem) done.push({ id: c.id, stem });
          else failedCards++;
        },
        { concurrency, sleepMs },
      );

      // 2) daarna pas de DB bijwerken — gebundeld in transacties
      await writeCardStems(done);
      mirroredCards += done.length;

      lastId = cards[cards.length - 1].id;
      processed += cards.length;
      console.log(
        `  … ${mirroredCards} gemirrord · ${failedCards} zonder beeld · laatste id=${lastId}`,
      );
    }
  }

  if (only === "logos" || only === "both") {
    if (isRemoteDb) await assertLiveHealthy(healthUrl);
    const sets = await prisma.cardSet.findMany({
      where: { pokewalletSetId: { not: null }, logoMirrorKey: null },
      select: { id: true, pokewalletSetId: true },
      take: limit,
    });
    console.log(`\nSet-logo's zonder mirror: ${sets.length} (max ${limit} deze run)`);
    const doneLogos: { id: string; stem: string }[] = [];
    await mapPaced(
      sets,
      async (s) => {
        const stem = await mirrorSetLogo(s);
        if (stem) doneLogos.push({ id: s.id, stem });
      },
      { concurrency, sleepMs },
    );
    await writeLogoStems(doneLogos);
    mirroredLogos = doneLogos.length;
    console.log(`  … ${mirroredLogos}/${sets.length} logo's gemirrord`);
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nKlaar in ${mins} min: ${mirroredCards} kaarten + ${mirroredLogos} logo's gemirrord, ` +
      `${failedCards} kaarten zonder beeld.`,
  );
  if (failedCards) {
    console.log(
      "(kaarten zonder beeld houden imageMirrorKey=null → blijven op TCGdex-fallback; " +
        "gebruik --cursor om er voorbij te gaan, of een latere run probeert ze opnieuw)",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    releaseLock();
    await prisma.$disconnect();
  });
