/**
 * Next.js instrumentation hook — wordt eenmalig aangeroepen bij server-start
 * (en na elke deploy/restart). Gebruikt om de auction-end scheduler te boot-en
 * zodat de eerstvolgende veiling op tijd gefinaliseerd wordt zonder dat
 * iemand de page hoeft te openen.
 *
 * Zie src/lib/auction-scheduler.ts voor hoe de scheduler werkt.
 */
export async function register() {
  // Alleen Node runtime — Edge runtime heeft geen prisma toegang en
  // setTimeout-state is daar per-request.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import zodat Edge-bundle de scheduler-modules niet meeneemt.
  const { scheduleNextAuctionFinalize } = await import("@/lib/auction-scheduler");
  const { scheduleNextAuctionActivation } = await import("@/lib/auction-activator-scheduler");
  const { scheduleNextClaimsaleActivation } = await import("@/lib/claimsale-activator-scheduler");

  try {
    await scheduleNextAuctionFinalize("boot");
  } catch (err) {
    // Niet fataal — de 5-min cron `auction-finalize` is de safety-net.
    // eslint-disable-next-line no-console
    console.error("[instrumentation] auction-finalize scheduler boot failed", err);
  }

  try {
    await scheduleNextAuctionActivation("boot");
  } catch (err) {
    // Niet fataal — de 1-min cron `auction-activate` is de safety-net.
    // eslint-disable-next-line no-console
    console.error("[instrumentation] auction-activator scheduler boot failed", err);
  }

  try {
    await scheduleNextClaimsaleActivation("boot");
  } catch (err) {
    // Niet fataal — de 1-min cron `claimsale-activate` is de safety-net.
    // eslint-disable-next-line no-console
    console.error("[instrumentation] claimsale-activator scheduler boot failed", err);
  }

  // In-process scheduler voor expire-claims: claimsale-items die >15 min in
  // iemands cart staan worden elke 60s automatisch teruggezet naar AVAILABLE.
  // Vervangt de externe cron-route als primaire trigger zodat het ook in
  // dev-mode + Railway zonder externe scheduler werkt.
  try {
    const { startExpireClaimsScheduler } = await import("@/lib/expire-claims-scheduler");
    startExpireClaimsScheduler("boot");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[instrumentation] expire-claims scheduler boot failed", err);
  }
}
