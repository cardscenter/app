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

  // Feature-flags (Community Hub, Fase 1): schedulers van verborgen
  // handelsfuncties starten niet. De CRON_JOBS-wrapper is de tweede laag
  // (route/"Run nu"/maintenance-schedulers slaan geblokkeerde jobs over).
  const { FEATURE_FLAG_KEYS, isFeatureEnabled } = await import("@/lib/feature-flags");
  const auctionsOn = isFeatureEnabled("FEATURE_AUCTIONS");
  const claimsalesOn = isFeatureEnabled("FEATURE_CLAIMSALES");
  const walletOn = isFeatureEnabled("FEATURE_WALLET");
  // eslint-disable-next-line no-console
  console.log(
    "[instrumentation] feature flags: " +
      FEATURE_FLAG_KEYS.map((k) => `${k}=${isFeatureEnabled(k) ? "aan" : "uit"}`).join(", "),
  );

  if (auctionsOn) {
    // Dynamic import zodat Edge-bundle de scheduler-modules niet meeneemt.
    const { scheduleNextAuctionFinalize } = await import("@/lib/auction-scheduler");
    const { scheduleNextAuctionActivation } = await import("@/lib/auction-activator-scheduler");

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
  }

  if (claimsalesOn) {
    const { scheduleNextClaimsaleActivation } = await import("@/lib/claimsale-activator-scheduler");
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

  // In-process scheduler voor sync-pokewallet: dagelijks om 03:00 UTC een
  // prijs-refresh + nieuwe-set-detectie via PokeWallet. Geen externe
  // scheduler nodig (cron-job.org / Railway-cron) — past in het bestaande
  // in-process patroon. HTTP-route /api/cron/sync-pokewallet blijft
  // beschikbaar voor "Run nu" in admin-panel.
  try {
    const { startPokewalletScheduler } = await import("@/lib/pokewallet-scheduler");
    startPokewalletScheduler("boot");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[instrumentation] pokewallet scheduler boot failed", err);
  }

  // In-process scheduler voor chat-ongelezen-mails (Fase 16): elke 5 min
  // checken of er chatberichten >15 min ongelezen zijn en de ontvanger mailen.
  // Cron-route /api/cron/email-unread-messages blijft als safety-net + "Run nu".
  try {
    const { startUnreadEmailScheduler } = await import("@/lib/unread-email-scheduler");
    startUnreadEmailScheduler("boot");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[instrumentation] unread-email scheduler boot failed", err);
  }

  // In-process scheduler voor order-onderhoud (Fase 44-feedback): elk uur
  // cancellation-expiry (7d mutual-deadline) + auto-cancel-stale-paid
  // (14d niet verzonden → volledige refund). De externe cron voor deze
  // routes was nooit ingesteld waardoor de flows in de praktijk dood waren.
  // Zonder wallet-flag draait er geen enkele order-job (ze vallen allemaal
  // onder FEATURE_WALLET of een handel-flag); alleen cleanup-notifications
  // blijft nodig en draait dan via de daily-maintenance-scheduler.
  if (walletOn) {
    try {
      const { startOrderMaintenanceScheduler } = await import("@/lib/order-maintenance-scheduler");
      startOrderMaintenanceScheduler("boot");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[instrumentation] order-maintenance scheduler boot failed", err);
    }
  }

  // Dagelijkse onderhoudscrons (04:30 UTC): check-subscriptions,
  // payment-failure-decay, prune-bid-ips, cleanup-sold-images,
  // cleanup-archived-chats + reset-free-upsells op de 1e van de maand.
  // Hiermee heeft geen enkele cron nog een externe scheduler nodig.
  try {
    const { startDailyMaintenanceScheduler } = await import("@/lib/daily-maintenance-scheduler");
    startDailyMaintenanceScheduler("boot");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[instrumentation] daily-maintenance scheduler boot failed", err);
  }

  // Route-hardening: zonder CRON_SECRET weigert /api/cron/* in productie alle
  // externe calls (zie src/lib/cron-auth.ts). Eén keer luid loggen bij boot.
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      "[instrumentation] CRON_SECRET ontbreekt — /api/cron/* is dicht voor externe calls; zet de Railway service-var.",
    );
  }
}
