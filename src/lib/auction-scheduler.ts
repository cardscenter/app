/**
 * Auction-end scheduler — sub-seconde-nauwkeurige finalize via in-process
 * setTimeout, zonder Redis of job-queue.
 *
 * Werking:
 *   1. scheduleNext() query't `MIN(endTime)` over alle ACTIVE auctions
 *   2. zet één setTimeout op (endTime + SCHEDULE_BUFFER_MS)
 *   3. handler roept finalizeAuction aan voor alles met endTime < now
 *   4. handler roept scheduleNext() opnieuw aan
 *
 * Anti-snipe (option A — self-correcting): als placeBid endTime verlengt
 * tijdens een al gescheduled timer, vuurt de timer alsnog op de oude tijd,
 * vindt de finalize-loop niets (endTime is nu in toekomst) en herrekent
 * MIN(endTime) → nieuwe schedule. Eén "vergeefse" wake-up per extension,
 * geen koppeling tussen placeBid en deze module.
 *
 * Safety-net: de 5-minuten cron `auction-finalize` blijft draaien voor
 * gevallen waar het Node-process crasht tussen schedule en fire, of waar
 * een deploy de timer doodt voordat boot-init weer gepakt heeft.
 *
 * HMR/Multi-load: timer-state op globalThis zodat dev HMR niet leidt tot
 * dubbele timers. scheduleNext() canceled altijd de bestaande timer voor
 * 'ie een nieuwe zet.
 */

import { prisma } from "@/lib/prisma";
import { finalizeAuction } from "@/actions/auction";

// 3 seconden buffer na endTime — dekt klokverschillen tussen DB en
// Node-proces, en geeft de DB even rust om de laatste anti-snipe
// extension te committen voordat we lezen.
const SCHEDULE_BUFFER_MS = 3000;

// Node setTimeout maximum (~24.8 dagen). Auctions duren max 14 dagen, dus
// in praktijk niet relevant — maar safety-clamp voor het geval een test
// een veiling 100 jaar in de toekomst zet.
const MAX_DELAY_MS = 2_147_483_000;

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  scheduledFor: Date | null;
  scheduledAuctionId: string | null;
  // Generation-counter zodat een fire-callback van een oude (gecanceld)
  // timer kan zien dat 'ie achterhaald is en niets meer hoeft te doen.
  generation: number;
  // Laatste 20 fire-events — handig voor debug op /dashboard/admin/crons
  history: Array<{
    firedAt: string;
    delayMs: number;
    processed: number;
    errors: number;
    nextScheduledFor: string | null;
  }>;
};

type GlobalWithScheduler = typeof globalThis & {
  __auctionScheduler?: SchedulerState;
};

const g = globalThis as GlobalWithScheduler;
if (!g.__auctionScheduler) {
  g.__auctionScheduler = {
    timer: null,
    scheduledFor: null,
    scheduledAuctionId: null,
    generation: 0,
    history: [],
  };
}
const state = g.__auctionScheduler;

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[auction-scheduler] ${msg}`);
}

function logError(msg: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[auction-scheduler] ${msg}`, err);
}

/**
 * Cancelt de bestaande timer (indien aanwezig) en zoekt de eerstvolgende
 * ACTIVE auction's endTime; daarop wordt een nieuwe timer gezet. Idempotent
 * en safe om vaak aan te roepen.
 *
 * Aan te roepen vanuit:
 *   - boot-init (instrumentation.ts)
 *   - na elke fire (intern, automatisch)
 *   - na createAuction (om eerder-eindigende veilingen op te pakken)
 *   - admin "Run scheduler now"-knop voor handmatige herberekening
 */
export async function scheduleNextAuctionFinalize(reason: string = "manual"): Promise<void> {
  // Cancel bestaande timer + bump generation zodat een eventuele in-flight
  // fire-callback weet dat 'ie achterhaald is.
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
      where: { status: "ACTIVE" },
      orderBy: { endTime: "asc" },
      select: { id: true, endTime: true, title: true },
    });
  } catch (err) {
    logError(`DB query failed during schedule (${reason})`, err);
    return;
  }

  if (!next) {
    log(`Idle — geen ACTIVE auctions (${reason})`);
    return;
  }

  // Als een nieuwere scheduleNext-aanroep al binnengekomen is tijdens onze
  // await, laat die het overnemen.
  if (myGen !== state.generation) {
    log(`Aborted — superseded by newer schedule call (${reason})`);
    return;
  }

  const now = Date.now();
  const fireAt = next.endTime.getTime() + SCHEDULE_BUFFER_MS;
  const delayMs = Math.max(0, Math.min(fireAt - now, MAX_DELAY_MS));

  state.scheduledFor = new Date(now + delayMs);
  state.scheduledAuctionId = next.id;
  state.timer = setTimeout(() => {
    // Check generation om dubbele/oude fires te vermijden (paranoia)
    if (myGen !== state.generation) {
      log(`Fire skipped — generation mismatch (was ${myGen}, now ${state.generation})`);
      return;
    }
    void runAndReschedule(myGen);
  }, delayMs);

  log(
    `Scheduled in ${(delayMs / 1000).toFixed(1)}s @ ${state.scheduledFor.toISOString()} ` +
      `for auction "${next.title}" (${next.id}) — reason: ${reason}`
  );
}

async function runAndReschedule(myGen: number): Promise<void> {
  if (myGen !== state.generation) return;

  const firedAt = new Date();
  state.timer = null;
  state.scheduledFor = null;
  state.scheduledAuctionId = null;

  const startedAt = Date.now();
  let processed = 0;
  let errors = 0;

  try {
    const expired = await prisma.auction.findMany({
      where: { status: "ACTIVE", endTime: { lt: new Date() } },
      select: { id: true },
      take: 200, // Safety-cap, gelijk aan de cron
    });

    log(`Fire — ${expired.length} expired auction(s) gevonden`);

    for (const a of expired) {
      try {
        await finalizeAuction(a.id);
        processed++;
      } catch (err) {
        errors++;
        logError(`finalizeAuction(${a.id}) failed`, err);
      }
    }
  } catch (err) {
    logError("Fire-handler DB query failed", err);
  }

  // Reschedule eerst, dan history updaten (zodat history nieuwe `scheduledFor` ziet)
  await scheduleNextAuctionFinalize("post-fire");

  // Cast nodig — TS narrowed state.scheduledFor naar `never` na de awaits
  // + reschedule-call die `state` muteert.
  const nextFor = state.scheduledFor as Date | null;
  state.history.unshift({
    firedAt: firedAt.toISOString(),
    delayMs: Date.now() - startedAt,
    processed,
    errors,
    nextScheduledFor: nextFor ? nextFor.toISOString() : null,
  });
  if (state.history.length > 20) state.history.length = 20;
}

/**
 * Read-only state-snapshot voor admin-debug-panel. Geen mutatie mogelijk
 * via deze functie — gebruik scheduleNextAuctionFinalize() om te re-schedulen.
 */
export function getSchedulerState(): {
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
