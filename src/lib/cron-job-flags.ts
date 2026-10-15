/**
 * Cron-jobnamen + de feature-flag waar elke job onder valt.
 *
 * De namenlijst staat hier (en niet in `cron-jobs.ts`) zodat dit bestand
 * Prisma-vrij blijft: `cron-jobs.ts`, de schedulers, het admin-panel en de
 * unit-tests importeren allemaal uit deze bron. `cron-jobs.ts` re-exporteert
 * `CRON_JOB_NAMES`/`CronJobName` voor bestaande importers.
 *
 * Een job met flag `null` draait altijd (kaart-sync, opruimen, mail).
 * Een job met een flag wordt overgeslagen zodra die flag uit staat — centraal
 * afgedwongen in de `CRON_JOBS`-wrapper, zodat HTTP-route, "Run nu" én de
 * in-process schedulers hetzelfde gedrag hebben.
 */
import { isFeatureEnabled, type FeatureFlag, type FlagEnv } from "./feature-flags";

export const CRON_JOB_NAMES = [
  "auto-confirm",
  "auto-resolve-disputes-v2",
  "check-subscriptions",
  "expire-claims",
  "sync-pokewallet",
  "auction-finalize",
  "auction-activate",
  "claimsale-activate",
  "auction-payment-deadline",
  "auction-runner-up-decision-deadline",
  "proposal-payment-deadline",
  "cancellation-expiry",
  "cleanup-archived-chats",
  "bundle-offer-expiry",
  "bundle-offer-payment-deadline",
  "pickup-reservation-timeout",
  "pickup-reminder",
  "auto-cancel-stale-paid",
  "payment-failure-decay",
  "prune-bid-ips",
  "reset-free-upsells",
  "cleanup-sold-images",
  "email-unread-messages",
  "cleanup-notifications",
  // Community Hub (Fase 3): winkel-events
  "expire-event-reservations",
  "expire-event-waitlist-offers",
] as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[number];

export const CRON_JOB_FLAG: Record<CronJobName, FeatureFlag | null> = {
  // Veilingen
  "auction-finalize": "FEATURE_AUCTIONS",
  "auction-activate": "FEATURE_AUCTIONS",
  "auction-payment-deadline": "FEATURE_AUCTIONS",
  "auction-runner-up-decision-deadline": "FEATURE_AUCTIONS",
  "payment-failure-decay": "FEATURE_AUCTIONS",
  "prune-bid-ips": "FEATURE_AUCTIONS",
  // Claimsales
  "expire-claims": "FEATURE_CLAIMSALES",
  "claimsale-activate": "FEATURE_CLAIMSALES",
  // Marktplaats
  "proposal-payment-deadline": "FEATURE_MARKETPLACE",
  "bundle-offer-expiry": "FEATURE_MARKETPLACE",
  "bundle-offer-payment-deadline": "FEATURE_MARKETPLACE",
  // Saldo / orders / abonnementen
  "auto-confirm": "FEATURE_WALLET",
  "auto-resolve-disputes-v2": "FEATURE_WALLET",
  "check-subscriptions": "FEATURE_WALLET",
  "cancellation-expiry": "FEATURE_WALLET",
  "pickup-reservation-timeout": "FEATURE_WALLET",
  "pickup-reminder": "FEATURE_WALLET",
  "auto-cancel-stale-paid": "FEATURE_WALLET",
  "reset-free-upsells": "FEATURE_WALLET",
  // Altijd
  "sync-pokewallet": null,
  "cleanup-archived-chats": null,
  "cleanup-sold-images": null,
  "email-unread-messages": null,
  "cleanup-notifications": null,
  // Winkel-events (hub): altijd aan
  "expire-event-reservations": null,
  "expire-event-waitlist-offers": null,
};

/** De flag die deze job momenteel blokkeert, of `null` als de job mag draaien. */
export function cronJobDisabledBy(name: CronJobName, env: FlagEnv = process.env): FeatureFlag | null {
  const flag = CRON_JOB_FLAG[name];
  if (!flag) return null;
  return isFeatureEnabled(flag, env) ? null : flag;
}
