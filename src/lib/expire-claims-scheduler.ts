// In-process scheduler voor `expireClaimedItems` — draait elke 60s op de
// Node-server. Vervangt de externe cron-route (`/api/cron/expire-claims`) als
// primaire trigger. De cron-route blijft bestaan voor handmatig "Run nu"
// vanuit het admin-panel.
//
// Hosting-aanname: single-instance Node-container (Railway). Voor
// multi-instance is dat geen probleem — `expireClaimedItems` is idempotent
// (UPDATE-WHERE op claimedAt < cutoff), parallelle runs leveren hetzelfde
// eindresultaat.
//
// HMR-resistance: we slaan het interval-handle op `globalThis` zodat
// dev-mode reloads niet leiden tot N parallelle intervals na N reloads.

const TICK_MS = 60_000;

interface SchedulerHandle {
  intervalId: NodeJS.Timeout;
  startedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var __expireClaimsScheduler: SchedulerHandle | undefined;
}

async function tick() {
  try {
    const { expireClaimedItems } = await import("@/actions/claimsale");
    const result = await expireClaimedItems();
    if (result.expired > 0) {
      console.log(
        `[expire-claims] in-process tick: ${result.expired} items released to AVAILABLE`,
      );
    }
  } catch (err) {
    // Niet fataal — volgende tick probeert opnieuw. De externe cron-route
    // blijft als safety-net beschikbaar via admin-panel.
    console.error("[expire-claims] in-process tick failed:", err);
  }
}

export function startExpireClaimsScheduler(reason: string) {
  // Stop een eventueel bestaande interval (HMR-reload of dubbele init).
  if (globalThis.__expireClaimsScheduler) {
    clearInterval(globalThis.__expireClaimsScheduler.intervalId);
  }

  // Eerste tick na 5s — zo loopt 'ie kort na boot al door eventuele
  // backlog die tijdens downtime is opgebouwd, zonder de boot-fase
  // te vertragen.
  setTimeout(() => tick(), 5_000);

  const intervalId = setInterval(tick, TICK_MS);
  globalThis.__expireClaimsScheduler = {
    intervalId,
    startedAt: new Date(),
  };
  console.log(
    `[expire-claims] in-process scheduler started (reason="${reason}", tick=${TICK_MS}ms)`,
  );
}
