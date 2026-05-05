/**
 * Veiling bid-tier constants (Fase 29)
 *
 * Apart bestand omdat client-componenten deze constants lezen voor UI-uitleg
 * ("15% wordt gereserveerd"). Files met `"use server"` mogen geen non-async
 * exports hebben, dus action-files kunnen deze constants niet bevatten.
 */

// Reserve-rate over elk bid-bedrag. Geldt voor zowel ACTIVE bids als
// AWAITING_PAYMENT-winnaars — één rate, één bron van waarheid.
export const BID_RESERVE_RATE = 0.10;

// Bids ≥ €2000 vereisen `User.isVerified === true` (tenzij admin-vrijgesteld
// via `isBusinessBidExempt`). Onder deze drempel is verificatie niet nodig.
// Drempel is gelijkgetrokken met de borg-trigger: 10% × €2000 = €200 borg —
// één getal, één regel.
export const VERIFIED_BID_THRESHOLD = 2000;

// €200 forfait dat verbeurd wordt bij wanbetaling op een ≥€2000-bid.
// Forfait wordt afgeboekt van User.balance op het moment dat cron
// auction-payment-deadline PAYMENT_FAILED flagt. Geen pre-storting.
// Gaat volledig naar het platform — seller is al beschermd via runner-up cascade.
export const BID_FORFEIT_AMOUNT = 200;

// Strike-systeem: wanneer triggered we welke suspend?
export const STRIKE_TEMP_SUSPEND_THRESHOLD = 2; // 2× wanbetaling → 30d suspend
export const STRIKE_TEMP_SUSPEND_DAYS = 30;
export const STRIKE_PERMANENT_THRESHOLD = 3; // 3× wanbetaling → permanent

// Strike-decay: na hoeveel dagen zonder nieuwe failure dropt de count met 1.
export const STRIKE_DECAY_DAYS = 365;

// Anti-shill-bidding: window waarbinnen een seller-IP-overlap als signaal
// telt. Window van 7 dagen voorkomt false-positives bij gestelde locaties
// (kantoor/koffiezaak waar seller jaren geleden ooit was).
export const IP_OVERLAP_LOOKBACK_DAYS = 7;

// Privacy-retentie: na hoeveel dagen `AuctionBid.bidderIp` genull't wordt
// door cron prune-bid-ips.
export const BID_IP_RETENTION_DAYS = 90;

/**
 * Pure helper: mag deze user dit bedrag bieden zonder verificatie?
 * - Bedragen onder VERIFIED_BID_THRESHOLD: altijd toegestaan
 * - Bedragen ≥ VERIFIED_BID_THRESHOLD: alleen als isVerified of isBusinessBidExempt
 */
export function bidPassesVerifiedGate(
  amount: number,
  user: { isVerified: boolean; isBusinessBidExempt: boolean },
): boolean {
  if (amount < VERIFIED_BID_THRESHOLD) return true;
  return user.isVerified || user.isBusinessBidExempt;
}
