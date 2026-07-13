/**
 * Stale-order flow (Fase 44-feedback) — drie fases na betaling van een
 * SHIP-bundle die niet verzonden wordt:
 *
 *  dag 7–14   waarschuwing bij de koper + mutual annuleringsverzoek mogelijk
 *  dag 14+    verzendtermijn verstreken → koper mag DIRECT annuleren met
 *             volledige terugbetaling (geen akkoord van de verkoper nodig —
 *             die heeft z'n leverplicht geschonden)
 *  dag 21+    koper deed niets → cron annuleert automatisch als vangnet
 *
 * Apart bestand zodat client-componenten de constants mogen importeren
 * (actions/cron-libs importeren prisma en zijn niet client-safe).
 */

/** Verzenddeadline voor de verkoper (dagen na betaling). */
export const STALE_PAID_SELLER_DEADLINE_DAYS = 14;

/** Hoe lang de koper daarna zelf mag kiezen vóór de cron ingrijpt. */
export const STALE_PAID_BUYER_GRACE_DAYS = 7;

/** Vanaf wanneer de koper de gele waarschuwing ziet. */
export const STALE_PAID_WARNING_AFTER_DAYS = 7;

/** Na zoveel dagen zonder verzending annuleert de cron automatisch. */
export const STALE_PAID_AUTO_CANCEL_AFTER_DAYS =
  STALE_PAID_SELLER_DEADLINE_DAYS + STALE_PAID_BUYER_GRACE_DAYS;
