// In-process scheduler voor de order-flow-onderhoudscrons (Fase 44-feedback).
// De externe scheduler voor /api/cron/* is nooit ingesteld, waardoor o.a.
// auto-cancel-stale-paid (14d niet verzonden → volledige refund) en
// cancellation-expiry (7d mutual-akkoord-deadline) nooit draaiden — een
// koper zat 66 dagen op een onverzonden bestelling zonder automatische
// annulering.
//
// Volgorde per tick is bewust: éérst cancellation-expiry (geeft PENDING-
// verzoeken >7d vrij), daarná auto-cancel-stale-paid — een openstaand
// PENDING-verzoek blokkeert de auto-cancel, dus zo wordt een geblokkeerde
// bundle in dezelfde tick alsnog geannuleerd.
//
// Patroon identiek aan expire-claims-scheduler: direct de CRON_JOBS-runners
// aanroepen (geen CronRun-rij per tick — dat zou 24×/dag bloat geven), de
// HTTP-routes blijven bestaan voor "Run nu" in het admin-panel mét logging.
// Beide jobs zijn race-safe (claim-first updateMany), dus een overlap met
// een handmatige run of externe cron is onschadelijk.
//
// HMR-resistance: interval-handle op globalThis zodat dev-reloads niet tot
// N parallelle intervals leiden.

const TICK_MS = 60 * 60 * 1000; // elk uur — deadlines zijn dag-granulair

// Volgorde is betekenisvol (zie boven).
const JOBS = ["cancellation-expiry", "auto-cancel-stale-paid"] as const;

interface SchedulerHandle {
  intervalId: NodeJS.Timeout;
  startedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var __orderMaintenanceScheduler: SchedulerHandle | undefined;
}

let tickRunning = false;

async function tick() {
  // Re-entrancy-guard: als een tick uitzonderlijk lang duurt (grote backlog
  // na downtime) mag de volgende interval-tick niet parallel starten.
  if (tickRunning) return;
  tickRunning = true;
  try {
    const { CRON_JOBS } = await import("@/lib/cron-jobs");
    for (const job of JOBS) {
      try {
        const result = await CRON_JOBS[job]();
        if (result.itemsProcessed > 0) {
          console.log(`[order-maintenance] ${job}: ${result.itemsProcessed} verwerkt`);
        }
      } catch (err) {
        // Niet fataal — volgende tick probeert opnieuw; route blijft safety-net.
        console.error(`[order-maintenance] ${job} failed:`, err);
      }
    }
  } finally {
    tickRunning = false;
  }
}

export function startOrderMaintenanceScheduler(reason: string) {
  if (globalThis.__orderMaintenanceScheduler) {
    clearInterval(globalThis.__orderMaintenanceScheduler.intervalId);
  }

  // Eerste tick 20s na boot: werkt direct de backlog weg die tijdens
  // downtime (of het nooit-draaien van de externe cron) is opgebouwd.
  setTimeout(() => tick(), 20_000);

  const intervalId = setInterval(tick, TICK_MS);
  globalThis.__orderMaintenanceScheduler = {
    intervalId,
    startedAt: new Date(),
  };
  console.log(
    `[order-maintenance] in-process scheduler started (reason="${reason}", tick=${TICK_MS}ms, jobs=${JOBS.join(", ")})`,
  );
}
