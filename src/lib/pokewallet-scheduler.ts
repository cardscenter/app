// In-process scheduler voor de dagelijkse `sync-pokewallet` cron. Vuurt
// elke nacht om 03:00 UTC (= 04:00 NL winter / 05:00 NL zomer — buiten
// piekuren in beide gevallen).
//
// Self-rescheduling via setTimeout omdat een 24-uurs setInterval onhandig
// is bij boot-mid-day: we willen exact op 03:00 UTC vallen, niet 24u na
// boot. Na elke tick (success of fail) plannen we de volgende fire-tijd.
//
// Hosting-aanname: single-instance Node-container (Railway). Multi-instance
// zou meerdere parallelle tikken geven; voor sync-pokewallet is dat
// onvriendelijk maar niet kapot (PokeWallet rate-limit kicks in eerder dan
// data-corruptie). Indien ooit multi-instance: hou een DB-leader-lock bij.
//
// HMR-resistance: timeout-handle op `globalThis` zodat dev-mode reloads
// niet leiden tot N parallelle schedulers.

const TARGET_HOUR_UTC = 3; // 03:00 UTC = 04:00 NL winter / 05:00 NL zomer
const TARGET_MINUTE = 0;
// Max veilige setTimeout-delay (32-bit int ms). Voor 1×/dag triggers nooit
// een issue, maar belt-and-braces voor edge-cases.
const MAX_TIMEOUT_MS = 2_147_483_000;

interface SchedulerHandle {
  timeoutId: NodeJS.Timeout;
  fireAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var __pokewalletScheduler: SchedulerHandle | undefined;
}

function computeNextFireAt(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(TARGET_HOUR_UTC, TARGET_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

async function tick() {
  try {
    const { CRON_JOBS } = await import("@/lib/cron-jobs");
    const { withCronLogging } = await import("@/lib/cron-logging");
    const runner = CRON_JOBS["sync-pokewallet"];
    await withCronLogging(
      "sync-pokewallet",
      async (run) => {
        const r = await runner();
        run.setItemsProcessed(r.itemsProcessed);
        return r.result;
      },
      "cron",
    );
  } catch (err) {
    // Niet fataal — volgende dag opnieuw. CronRun-rij toont FAILED zodat
    // admin het ziet in /dashboard/admin/crons.
    // eslint-disable-next-line no-console
    console.error("[pokewallet-scheduler] tick faalde:", err);
  } finally {
    // Altijd doorplannen, ook na crash, zodat de scheduler blijft leven.
    scheduleNextTick("after-tick");
  }
}

function scheduleNextTick(reason: string) {
  if (globalThis.__pokewalletScheduler) {
    clearTimeout(globalThis.__pokewalletScheduler.timeoutId);
  }
  const fireAt = computeNextFireAt();
  const delayMs = Math.min(fireAt.getTime() - Date.now(), MAX_TIMEOUT_MS);
  const timeoutId = setTimeout(tick, delayMs);
  globalThis.__pokewalletScheduler = { timeoutId, fireAt };
  // eslint-disable-next-line no-console
  console.log(
    `[pokewallet-scheduler] next fire @ ${fireAt.toISOString()} ` +
      `(reason="${reason}", in ${Math.round(delayMs / 1000 / 60)}m)`,
  );
}

export function startPokewalletScheduler(reason: string) {
  scheduleNextTick(reason);
}
