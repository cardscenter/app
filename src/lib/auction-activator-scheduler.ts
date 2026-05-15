/**
 * Auction-activator scheduler — sub-seconde-nauwkeurige flip van
 * SCHEDULED → ACTIVE op het moment dat `startTime` bereikt is.
 *
 * Mirror van src/lib/auction-scheduler.ts, maar voor activatie ipv finalize:
 *   1. scheduleNextAuctionActivation() query't `MIN(startTime)` over alle
 *      SCHEDULED auctions
 *   2. zet één setTimeout op (startTime + SCHEDULE_BUFFER_MS)
 *   3. handler flipt alle SCHEDULED met `startTime <= now` naar ACTIVE en
 *      publisht `auction-started` events op auctionChannel(id)
 *   4. handler bumpt scheduleNextAuctionFinalize() zodat de finalize-
 *      scheduler de nieuw-ACTIVE auctions oppakt
 *   5. handler reschedulet zichzelf
 *
 * Safety-net: de cron `auction-activate` (elke minuut) doet hetzelfde werk.
 * In-process scheduler is voor sub-seconde precisie.
 */

import { prisma } from "@/lib/prisma";
import { publish, auctionChannel } from "@/lib/realtime";

const SCHEDULE_BUFFER_MS = 3000;
const MAX_DELAY_MS = 2_147_483_000;

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  scheduledFor: Date | null;
  scheduledAuctionId: string | null;
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
  __auctionActivator?: SchedulerState;
};

const g = globalThis as GlobalWithActivator;
if (!g.__auctionActivator) {
  g.__auctionActivator = {
    timer: null,
    scheduledFor: null,
    scheduledAuctionId: null,
    generation: 0,
    history: [],
  };
}
const state = g.__auctionActivator;

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[auction-activator] ${msg}`);
}

function logError(msg: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[auction-activator] ${msg}`, err);
}

export async function scheduleNextAuctionActivation(reason: string = "manual"): Promise<void> {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.generation += 1;
  const myGen = state.generation;
  state.scheduledFor = null;
  state.scheduledAuctionId = null;

  let next;
  try {
    next = await prisma.auction.findFirst({
      where: { status: "SCHEDULED", startTime: { not: null } },
      orderBy: { startTime: "asc" },
      select: { id: true, startTime: true, title: true },
    });
  } catch (err) {
    logError(`DB query failed during schedule (${reason})`, err);
    return;
  }

  if (!next || !next.startTime) {
    log(`Idle — geen SCHEDULED auctions (${reason})`);
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
  state.scheduledAuctionId = next.id;
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
  state.scheduledAuctionId = null;

  const startedAt = Date.now();
  let activated = 0;
  let errors = 0;

  try {
    const due = await prisma.auction.findMany({
      where: { status: "SCHEDULED", startTime: { lte: new Date() } },
      select: { id: true },
      take: 200,
    });

    log(`Fire — ${due.length} due auction(s) gevonden`);

    for (const a of due) {
      try {
        // Race-safe flip: alleen wanneer status nog SCHEDULED is. Idempotent
        // als de cron tegelijkertijd al een flip deed.
        const claim = await prisma.auction.updateMany({
          where: { id: a.id, status: "SCHEDULED" },
          data: { status: "ACTIVE" },
        });
        if (claim.count > 0) {
          publish(auctionChannel(a.id), { type: "auction-started", payload: { auctionId: a.id } });
          activated++;
        }
      } catch (err) {
        errors++;
        logError(`activate(${a.id}) failed`, err);
      }
    }
  } catch (err) {
    logError("Fire-handler DB query failed", err);
  }

  // Bump finalize-scheduler want we hebben nu nieuwe ACTIVE auctions.
  if (activated > 0) {
    try {
      const { scheduleNextAuctionFinalize } = await import("@/lib/auction-scheduler");
      await scheduleNextAuctionFinalize("post-activation");
    } catch (err) {
      logError("finalize-scheduler bump failed", err);
    }
  }

  await scheduleNextAuctionActivation("post-fire");

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

export function getActivatorState(): {
  hasTimer: boolean;
  scheduledFor: string | null;
  scheduledAuctionId: string | null;
  generation: number;
  history: SchedulerState["history"];
} {
  return {
    hasTimer: state.timer !== null,
    scheduledFor: state.scheduledFor ? state.scheduledFor.toISOString() : null,
    scheduledAuctionId: state.scheduledAuctionId,
    generation: state.generation,
    history: [...state.history],
  };
}
