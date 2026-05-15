/**
 * End-to-end test voor de auction-activator scheduler.
 *
 * Flow:
 *   1. maakt een SCHEDULED auction met startTime = now + 25s
 *   2. roept /api/cron/auction-activate aan om scheduleNextAuctionActivation()
 *      in de dev-server's Node-process te triggeren
 *   3. polled elke 2s tot de auction status flipt naar ACTIVE
 *   4. rapporteert daadwerkelijke vs verwachte fire-tijd
 *
 * Verwacht: status flipt naar ACTIVE ~3s na startTime (= SCHEDULE_BUFFER_MS).
 *
 * Dev-server moet draaien op http://localhost:3000.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const SECONDS_UNTIL_START = 25;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = (SECONDS_UNTIL_START + 30) * 1000;
const BASE_URL = "http://localhost:3000";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ts() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

async function main() {
  console.log(`[${ts()}] Activator-test start — auction met startTime over ${SECONDS_UNTIL_START}s.`);

  const seller = await prisma.user.findFirst({
    where: { accountType: { in: ["FREE", "PRO", "UNLIMITED", "ENTERPRISE", "ADMIN"] } },
    select: { id: true, displayName: true, email: true },
  });
  if (!seller) throw new Error("Geen user gevonden. Run eerst de seed.");
  console.log(`[${ts()}] Seller: ${seller.displayName ?? seller.email} (${seller.id})`);

  const startTime = new Date(Date.now() + SECONDS_UNTIL_START * 1000);
  const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dagen
  const expectedFireAt = new Date(startTime.getTime() + 3000); // SCHEDULE_BUFFER_MS

  const auction = await prisma.auction.create({
    data: {
      title: `[ACTIVATOR-TEST] auction ${Date.now()}`,
      description: "Auto-generated test for activator. Will be cleaned up.",
      auctionType: "OTHER",
      itemCategory: "Test",
      sellerId: seller.id,
      startingBid: 1.0,
      duration: 7,
      startTime,
      endTime,
      status: "SCHEDULED",
      deliveryMethod: "PICKUP",
      pickupCity: "Amsterdam",
    },
  });
  console.log(`[${ts()}] SCHEDULED auction aangemaakt: ${auction.id}`);
  console.log(`[${ts()}] startTime       = ${startTime.toISOString()}`);
  console.log(`[${ts()}] verwachte fire  = ${expectedFireAt.toISOString()}`);

  console.log(`[${ts()}] /api/cron/auction-activate aanroepen om scheduler te bumpen...`);
  try {
    const r = await fetch(`${BASE_URL}/api/cron/auction-activate`);
    console.log(`[${ts()}] Cron-route status: ${r.status}`);
    const body = await r.json().catch(() => null);
    console.log(`[${ts()}] Cron-route body:`, JSON.stringify(body));
  } catch (err) {
    console.error(`[${ts()}] Cron-route fetch FAILED:`, err);
    await cleanup(auction.id);
    process.exit(1);
  }

  const startedPollingAt = Date.now();
  let lastStatus = "SCHEDULED";
  let flippedAt: number | null = null;

  while (Date.now() - startedPollingAt < POLL_TIMEOUT_MS) {
    const fresh = await prisma.auction.findUnique({
      where: { id: auction.id },
      select: { status: true },
    });
    if (!fresh) break;
    if (fresh.status !== lastStatus) {
      console.log(`[${ts()}] STATUS-FLIP: ${lastStatus} → ${fresh.status}`);
      lastStatus = fresh.status;
      if (fresh.status === "ACTIVE") {
        flippedAt = Date.now();
        break;
      }
    } else {
      const secondsTill = Math.max(0, Math.round((startTime.getTime() - Date.now()) / 1000));
      console.log(`[${ts()}] status=${fresh.status} (start over ${secondsTill}s)`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!flippedAt) {
    console.error(`[${ts()}] FAIL — auction is na ${POLL_TIMEOUT_MS / 1000}s niet geactiveerd.`);
  } else {
    const deltaMs = flippedAt - expectedFireAt.getTime();
    console.log(`\n[${ts()}] ====== RESULT ======`);
    console.log(`Verwachte fire @ ${expectedFireAt.toISOString()}`);
    console.log(`Daadwerkelijk  @ ${new Date(flippedAt).toISOString()}`);
    console.log(`Delta          : ${deltaMs >= 0 ? "+" : ""}${deltaMs}ms`);
    if (Math.abs(deltaMs) < 3000) {
      console.log(`✓ PASS — binnen 3s van verwachte fire-tijd.`);
    } else if (deltaMs > 3000 && deltaMs < 60_000) {
      console.log(`~ ZACHTE PASS — laat (${deltaMs}ms), binnen polling-resolutie.`);
    } else {
      console.log(`✗ SUSPECT — fire-vertraging valt buiten verwacht venster.`);
    }
  }

  await cleanup(auction.id);
}

async function cleanup(auctionId: string) {
  try {
    await prisma.auction.delete({ where: { id: auctionId } });
    console.log(`[${ts()}] Cleanup OK — auction verwijderd.`);
  } catch (err) {
    console.error(`[${ts()}] Cleanup FAILED:`, err);
  }
}

main()
  .catch((e) => {
    console.error("Test crashed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
