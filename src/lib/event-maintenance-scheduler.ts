// In-process scheduler voor de winkel-events (Community Hub, Fase 3): elke
// 60s verlopen ticket-reserveringen (10 min) en wachtlijst-aanbiedingen (24u)
// opruimen en de vrijgekomen plek aan de wachtlijst aanbieden. Zelfde patroon
// als expire-claims-scheduler (HMR-safe via globalThis, cron-routes als
// safety-net + "Run nu" in het admin-panel).

const TICK_MS = 60_000;

interface SchedulerHandle {
  intervalId: NodeJS.Timeout;
  startedAt: Date;
}

declare global {

  var __eventMaintenanceScheduler: SchedulerHandle | undefined;
}

async function tick() {
  try {
    const { CRON_JOBS } = await import("@/lib/cron-jobs");
    const a = await CRON_JOBS["expire-event-reservations"]();
    const b = await CRON_JOBS["expire-event-waitlist-offers"]();
    const c = await CRON_JOBS["expire-food-payments"]();
    if (a.itemsProcessed > 0 || b.itemsProcessed > 0 || c.itemsProcessed > 0) {
      console.log(`[event-maintenance] reserveringen verlopen: ${a.itemsProcessed}, aanbiedingen verlopen: ${b.itemsProcessed}, onbetaalde bestellingen: ${c.itemsProcessed}`);
    }
  } catch (err) {
    console.error("[event-maintenance] in-process tick failed:", err);
  }
}

export function startEventMaintenanceScheduler(reason: string) {
  if (globalThis.__eventMaintenanceScheduler) {
    clearInterval(globalThis.__eventMaintenanceScheduler.intervalId);
  }
  setTimeout(() => tick(), 8_000);
  const intervalId = setInterval(tick, TICK_MS);
  globalThis.__eventMaintenanceScheduler = { intervalId, startedAt: new Date() };
  console.log(`[event-maintenance] in-process scheduler started (reason="${reason}", tick=${TICK_MS}ms)`);
}
