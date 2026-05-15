/**
 * End-to-end test voor de auction-end scheduler.
 *
 * Wat het doet:
 *   1. maakt een minimale ACTIVE auction met endTime = now + 25s
 *   2. roept /api/cron/auction-finalize aan om scheduleNext() in de
 *      dev-server's Node-process te triggeren
 *   3. polled elke 2s tot de auction status flipt
 *   4. rapporteert daadwerkelijke vs verwachte fire-tijd
 *
 * Verwacht: status flipt naar ENDED_NO_BIDS ~3s na endTime (= SCHEDULE_BUFFER_MS).
 *
 * Dev-server moet draaien op http://localhost:3000.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

const SECONDS_UNTIL_END = 25;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = (SECONDS_UNTIL_END + 30) * 1000;
const BASE_URL = "http://localhost:3000";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ts() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

async function main() {
  console.log(`[${ts()}] Test starten — auction over ${SECONDS_UNTIL_END}s laten eindigen.`);

  // Vind een seller — neem de eerste user.
  const seller = await prisma.user.findFirst({
    where: { accountType: { in: ["FREE", "PRO", "UNLIMITED", "ENTERPRISE", "ADMIN"] } },
    select: { id: true, displayName: true, email: true },
  });
  if (!seller) {
    throw new Error("Geen user gevonden. Run eerst de seed.");
  }
  console.log(`[${ts()}] Seller: ${seller.displayName ?? seller.email} (${seller.id})`);

  // Maak een minimale test-auction.
  const endTime = new Date(Date.now() + SECONDS_UNTIL_END * 1000);
  const expectedFireAt = new Date(endTime.getTime() + 3000); // SCHEDULE_BUFFER_MS

  const auction = await prisma.auction.create({
    data: {
      title: `[SCHEDULER-TEST] auction ${Date.now()}`,
      description: "Auto-generated test for scheduler. Will be cleaned up.",
      auctionType: "OTHER",
      itemCategory: "Test",
      sellerId: seller.id,
      startingBid: 1.0,
      duration: 1,
      endTime,
      status: "ACTIVE",
      deliveryMethod: "PICKUP",
      pickupCity: "Amsterdam",
    },
  });
  console.log(`[${ts()}] Auction aangemaakt: ${auction.id}`);
  console.log(`[${ts()}] endTime         = ${endTime.toISOString()}`);
  console.log(`[${ts()}] verwachte fire  = ${expectedFireAt.toISOString()} (endTime + 3s buffer)`);

  // Trigger scheduler-bump via cron-route.
  console.log(`[${ts()}] /api/cron/auction-finalize aanroepen om scheduler te bumpen...`);
  try {
    const r = await fetch(`${BASE_URL}/api/cron/auction-finalize`);
    console.log(`[${ts()}] Cron-route status: ${r.status}`);
    const body = await r.json().catch(() => null);
    console.log(`[${ts()}] Cron-route body:`, JSON.stringify(body));
  } catch (err) {
    console.error(`[${ts()}] Cron-route fetch FAILED — draait de dev-server?`, err);
    await cleanup(auction.id);
    process.exit(1);
  }

  // Poll auction status tot 'ie flipt.
  const startedPollingAt = Date.now();
  let lastStatus = "ACTIVE";
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
      if (fresh.status !== "ACTIVE") {
        flippedAt = Date.now();
        break;
      }
    } else {
      const secondsTillEnd = Math.max(0, Math.round((endTime.getTime() - Date.now()) / 1000));
      console.log(`[${ts()}] status=${fresh.status} (eindetijd over ${secondsTillEnd}s)`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!flippedAt) {
    console.error(`[${ts()}] FAIL — auction is na ${POLL_TIMEOUT_MS / 1000}s nog niet gefinaliseerd.`);
    console.error(`         Mogelijke oorzaken: dev-server is niet herstart sinds de scheduler werd toegevoegd,`);
    console.error(`         instrumentation.ts wordt niet geladen, of de cron-route faalt silent.`);
  } else {
    const deltaMs = flippedAt - expectedFireAt.getTime();
    console.log(`\n[${ts()}] ====== RESULT ======`);
    console.log(`Verwachte fire @ ${expectedFireAt.toISOString()}`);
    console.log(`Daadwerkelijk  @ ${new Date(flippedAt).toISOString()}`);
    console.log(`Delta          : ${deltaMs >= 0 ? "+" : ""}${deltaMs}ms`);
    if (Math.abs(deltaMs) < 3000) {
      console.log(`✓ PASS — binnen 3s van verwachte fire-tijd.`);
    } else if (deltaMs > 3000 && deltaMs < 60_000) {
      console.log(`~ ZACHTE PASS — laat (${deltaMs}ms), maar binnen polling-resolutie. Probeer POLL_INTERVAL_MS te verlagen.`);
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
