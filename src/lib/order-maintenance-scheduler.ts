// In-process scheduler voor de order-flow-onderhoudscrons (Fase 44-feedback).
// De externe scheduler voor /api/cron/* is nooit ingesteld, waardoor ALLE
// tijdgestuurde order-flow-crons nooit draaiden: auto-cancel-stale-paid
// (koper zat 66 dagen op een onverzonden bestelling), maar óók de
// betaaldeadlines — veilingen bleven eeuwig in AWAITING_PAYMENT hangen mét
// 10%-reserve op het kopersaldo, omdat auction-payment-deadline de
// wanbetaler-flow + runner-up-rotatie nooit startte.
//
// Deze scheduler draait daarom de complete order-lifecycle-set. Volgorde is
// deels betekenisvol:
// - cancellation-expiry vóór auto-cancel-stale-paid: een openstaand
//   PENDING-verzoek blokkeert de auto-cancel; expiry geeft 'm vrij zodat
//   dezelfde tick de bundle alsnog annuleert.
// - auction-runner-up-decision-deadline vóór auction-payment-deadline:
//   verlopen 72u-windows eerst doorschuiven, daarna nieuwe wanbetalers.
//
// NIET in deze set (bewust): reset-free-upsells (maand-semantiek — uurlijks
// draaien zou quota continu bijvullen), payment-failure-decay + prune-bid-ips
// (week-cadans, niet order-kritisch), cleanup-* (destructief), check-
// subscriptions (eigen domein), en alles met een eigen in-process scheduler
// (auction-finalize/activate, expire-claims, email-unread-messages).
//
// Patroon identiek aan expire-claims-scheduler: direct de CRON_JOBS-runners
// aanroepen (geen CronRun-rij per tick — dat zou 24×/dag bloat geven), de
// HTTP-routes blijven bestaan voor "Run nu" in het admin-panel mét logging.
// Alle jobs zijn idempotent en race-safe (claim-first/conditional updateMany),
// dus een overlap met een handmatige run of externe cron is onschadelijk.
//
// HMR-resistance: interval-handle op globalThis zodat dev-reloads niet tot
// N parallelle intervals leiden.

const TICK_MS = 60 * 60 * 1000; // elk uur — deadlines zijn dag/uur-granulair

// Volgorde is deels betekenisvol (zie boven).
const JOBS = [
  "cancellation-expiry",
  "auto-cancel-stale-paid",
  "auction-runner-up-decision-deadline",
  "auction-payment-deadline",
  "proposal-payment-deadline",
  "bundle-offer-expiry",
  "bundle-offer-payment-deadline",
  "pickup-reservation-timeout",
  "pickup-reminder",
  "auto-confirm",
  "auto-resolve-disputes",
  "auto-resolve-disputes-v2",
] as const;

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
