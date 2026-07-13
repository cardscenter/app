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
export const VERIFIED_BID_THRESHOLD = 2000;

// Borg-forfait bij wanbetaling (Fase 44): de VOLLEDIGE 10%-reservering
// (10% × (bod + 2,9% veilingkosten), zie `calculateReserveForBid` in
// balance-check.ts) verbeurt aan het platform — voor élk bedrag. De reserve
// stond tijdens AWAITING_PAYMENT al vast op het saldo, dus het forfait is in
// de praktijk altijd inbaar; de clamp + PendingPlatformFee blijven als
// safety-net. Verving het vaste €200-forfait dat alleen ≥€2000 gold
// (BID_FORFEIT_AMOUNT, verwijderd) — 10% van ≥€2000 is altijd ≥€205,80, dus
// niemand ging er door deze wijziging op vooruit.

// Universele payment-failure-fee: 2,9% × bod, ALLE bedragen, geclampt op
// User.balance ná het reservering-forfait. Voorbeeld €1000-bod: €102,90
// forfait + €29 fee = €131,90 boete. €45-bod: €4,63 + €1,31 = €5,94.
// Gaat 100% naar platform via Transaction.type = "BID_PAYMENT_FAILURE_FEE".
export const PAYMENT_FAILURE_FEE_RATE = 0.029;

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
