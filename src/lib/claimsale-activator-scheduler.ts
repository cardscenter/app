/**
 * Claimsale-activator scheduler — sub-seconde-nauwkeurige flip van
 * SCHEDULED → LIVE op het moment dat `startTime` bereikt is.
 *
 * Mirror van src/lib/auction-activator-scheduler.ts, maar voor claimsales:
 *   1. scheduleNextClaimsaleActivation() query't `MIN(startTime)` over alle
 *      SCHEDULED claimsales
 *   2. zet één setTimeout op (startTime + SCHEDULE_BUFFER_MS)
 *   3. handler flipt alle SCHEDULED met `startTime <= now` naar LIVE en
 *      publisht `claimsale-started` events op claimsaleChannel(id)
 *   4. handler reschedulet zichzelf
 *
 * Claimsales hebben geen finalize-fase (ze sluiten als items weg zijn), dus
 * geen finalize-scheduler-bump zoals de auction-variant.
 *
 * Safety-net: de cron `claimsale-activate` (elke minuut) doet hetzelfde werk.
 * In-process scheduler is voor sub-seconde precisie.
 */

import { prisma } from "@/lib/prisma";
import { publish, claimsaleChannel } from "@/lib/realtime";

const SCHEDULE_BUFFER_MS = 3000;
const MAX_DELAY_MS = 2_147_483_000;

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  scheduledFor: Date | null;
  scheduledClaimsaleId: string | null;
  generation: number;
  history: Array<{
    firedAt: string;
    delayMs: number;
    activated: number;
    errors: number;
    nextScheduledFor: string | null;
  }>;
};

type GlobalWithActivator = typeof globalThis & {
  __claimsaleActivator?: SchedulerState;
};

const g = globalThis as GlobalWithActivator;
if (!g.__claimsaleActivator) {
  g.__claimsaleActivator = {
    timer: null,
    scheduledFor: null,
    scheduledClaimsaleId: null,
    generation: 0,
    history: [],
  };
}
const state = g.__claimsaleActivator;

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[claimsale-activator] ${msg}`);
}

function logError(msg: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[claimsale-activator] ${msg}`, err);
}

export async function scheduleNextClaimsaleActivation(reason: string = "manual"): Promise<void> {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.generation += 1;
  const myGen = state.generation;
  state.scheduledFor = null;
  state.scheduledClaimsaleId = null;

  let next;
  try {
    next = await prisma.claimsale.findFirst({
      where: { status: "SCHEDULED", startTime: { not: null } },
      orderBy: { startTime: "asc" },
      select: { id: true, startTime: true, title: true },
    });
  } catch (err) {
    logError(`DB query failed during schedule (${reason})`, err);
    return;
  }

  if (!next || !next.startTime) {
    log(`Idle — geen SCHEDULED claimsales (${reason})`);
    return;
  }

  if (myGen !== state.generation) {
    log(`Aborted — superseded (${reason})`);
    return;
  }

  const now = Date.now();
  const fireAt = next.startTime.getTime() + SCHEDULE_BUFFER_MS;
  const delayMs = Math.max(0, Math.min(fireAt - now, MAX_DELAY_MS));

  state.scheduledFor = new Date(now + delayMs);
  state.scheduledClaimsaleId = next.id;
  state.timer = setTimeout(() => {
    if (myGen !== state.generation) {
      log(`Fire skipped — generation mismatch`);
      return;
    }
    void runAndReschedule(myGen);
  }, delayMs);

  log(
    `Scheduled in ${(delayMs / 1000).toFixed(1)}s @ ${state.scheduledFor.toISOString()} ` +
      `for "${next.title}" (${next.id}) — reason: ${reason}`
  );
}

async function runAndReschedule(myGen: number): Promise<void> {
  if (myGen !== state.generation) return;

  const firedAt = new Date();
  state.timer = null;
  state.scheduledFor = null;
  state.scheduledClaimsaleId = null;

  const startedAt = Date.now();
  let activated = 0;
  let errors = 0;

  try {
    const due = await prisma.claimsale.findMany({
      where: { status: "SCHEDULED", startTime: { lte: new Date() } },
      select: { id: true },
      take: 200,
    });

    log(`Fire — ${due.length} due claimsale(s) gevonden`);

    for (const c of due) {
      try {
        // Race-safe flip: alleen wanneer status nog SCHEDULED is. Idempotent
        // als de cron tegelijkertijd al een flip deed.
        const claim = await prisma.claimsale.updateMany({
          where: { id: c.id, status: "SCHEDULED" },
          data: { status: "LIVE" },
        });
        if (claim.count > 0) {
          publish(claimsaleChannel(c.id), {
            type: "claimsale-started",
            payload: { claimsaleId: c.id },
          });
          activated++;
        }
      } catch (err) {
        errors++;
        logError(`activate(${c.id}) failed`, err);
      }
    }
  } catch (err) {
    logError("Fire-handler DB query failed", err);
  }

  await scheduleNextClaimsaleActivation("post-fire");

  // Cast nodig — TS narrowed `state.scheduledFor` naar `never` na alle
  // awaits + de reschedule-call die `state` muteert.
  const nextFor = state.scheduledFor as Date | null;
  state.history.unshift({
    firedAt: firedAt.toISOString(),
    delayMs: Date.now() - startedAt,
    activated,
    errors,
    nextScheduledFor: nextFor ? nextFor.toISOString() : null,
  });
  if (state.history.length > 20) state.history.length = 20;
}

export function getClaimsaleActivatorState(): {
  hasTimer: boolean;
  scheduledFor: string | null;
  scheduledClaimsaleId: string | null;
  generation: number;
  history: SchedulerState["history"];
} {
  return {
    hasTimer: state.timer !== null,
    scheduledFor: state.scheduledFor ? state.scheduledFor.toISOString() : null,
    scheduledClaimsaleId: state.scheduledClaimsaleId,
    generation: state.generation,
    history: [...state.history],
  };
}
