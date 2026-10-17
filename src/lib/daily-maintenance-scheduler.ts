// In-process scheduler voor de dagelijkse onderhoudscrons die géén eigen
// scheduler hadden en dus in productie nooit draaiden (de externe scheduler
// voor /api/cron/* is nooit ingesteld): check-subscriptions (verlopen
// abonnementen), payment-failure-decay, prune-bid-ips (retentiebelofte uit het
// privacybeleid), cleanup-sold-images (R2-kosten) en cleanup-archived-chats.
// Plus, alleen op de 1e van de maand, reset-free-upsells.
//
// Vuurt dagelijks om 04:30 UTC — ná de pokewallet-sync (03:00 UTC) en buiten
// NL-piekuren. Self-rescheduling via setTimeout (patroon pokewallet-scheduler)
// zodat de tick op een vast uur valt i.p.v. "24u na boot".
//
// Elke job loopt via withCronLogging zodat er 1 CronRun-rij per dag per job
// ontstaat — admin ziet de status in /dashboard/admin/crons. De HTTP-routes
// blijven bestaan als safety-net + "Run nu".
//
// Dagelijks draaien is veilig: payment-failure-decay zet paymentFailureLastAt
// bij decrement (365d-lock), prune-bid-ips is een updateMany < cutoff, de
// cleanups hebben eigen idempotentie-guards. reset-free-upsells is NIET
// idempotent (vult quota bij) en draait daarom alleen op dag 1.
//
// Hosting-aanname: single-instance Node-container (Railway). HMR-resistance
// via globalThis-handle.

import { cronJobDisabledBy, type CronJobName } from "@/lib/cron-job-flags";

const TARGET_HOUR_UTC = 4;
const TARGET_MINUTE = 30;
const MAX_TIMEOUT_MS = 2_147_483_000;

// Volgorde: goedkoop/niet-destructief eerst, destructieve cleanups laatst.
const DAILY_JOBS = [
  "check-subscriptions",
  "payment-failure-decay",
  "prune-bid-ips",
  "cleanup-sold-images",
  "cleanup-archived-chats",
  // Meldingen-retentie zit normaal in de order-maintenance-scheduler; die
  // start niet zonder FEATURE_WALLET, dus hier als vangnet (idempotent).
  "cleanup-notifications",
] as const satisfies readonly CronJobName[];

const MONTHLY_JOBS = ["reset-free-upsells"] as const satisfies readonly CronJobName[];

interface SchedulerHandle {
  timeoutId: NodeJS.Timeout;
  fireAt: Date;
}

declare global {

  var __dailyMaintenanceScheduler: SchedulerHandle | undefined;
}

let tickRunning = false;

function computeNextFireAt(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(TARGET_HOUR_UTC, TARGET_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

async function runJob(name: CronJobName) {
  const { CRON_JOBS } = await import("@/lib/cron-jobs");
  const { withCronLogging } = await import("@/lib/cron-logging");
  try {
    await withCronLogging(
      name,
      async (run) => {
        const r = await CRON_JOBS[name]();
        run.setItemsProcessed(r.itemsProcessed);
        return r.result;
      },
      "cron",
    );
  } catch (err) {
    // CronRun-rij staat al op FAILED; volgende dag opnieuw.

    console.error(`[daily-maintenance] ${name} failed:`, err);
  }
}

async function tick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const isFirstOfMonth = new Date().getUTCDate() === 1;
    const jobs: CronJobName[] = [...DAILY_JOBS, ...(isFirstOfMonth ? MONTHLY_JOBS : [])];
    for (const job of jobs) {
      // Feature-flags (Community Hub, Fase 1): geblokkeerde jobs overslaan,
      // zonder CronRun-rij (anders dagelijks een lege SUCCESS-regel).
      if (cronJobDisabledBy(job)) continue;
      await runJob(job);
    }
  } finally {
    tickRunning = false;
    scheduleNextTick("after-tick");
  }
}

function scheduleNextTick(reason: string) {
  if (globalThis.__dailyMaintenanceScheduler) {
    clearTimeout(globalThis.__dailyMaintenanceScheduler.timeoutId);
  }
  const fireAt = computeNextFireAt();
  const delayMs = Math.min(fireAt.getTime() - Date.now(), MAX_TIMEOUT_MS);
  const timeoutId = setTimeout(tick, delayMs);
  globalThis.__dailyMaintenanceScheduler = { timeoutId, fireAt };

  console.log(
    `[daily-maintenance] next fire @ ${fireAt.toISOString()} ` +
      `(reason="${reason}", in ${Math.round(delayMs / 1000 / 60)}m, jobs=${DAILY_JOBS.join(", ")}${
        MONTHLY_JOBS.length ? ` + maandelijks: ${MONTHLY_JOBS.join(", ")}` : ""
      })`,
  );
}

export function startDailyMaintenanceScheduler(reason: string) {
  scheduleNextTick(reason);
}
