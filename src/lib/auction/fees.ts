// Buyer's premium voor veilingen (Fase 31, verlaagd in Fase 32).
//
// 2,9% wordt over elk winnend bod afgeschreven van de koper en gaat 100% naar
// het platform via een aparte Transaction met type "AUCTION_PREMIUM". De
// seller krijgt z'n volledige bod in escrow en wordt apart belast met z'n
// eigen tier-commissie via releaseEscrow.
//
// Geen tier-discount op de premium — Enterprise heeft al 0% seller-commissie
// + €749/m vaste prijs als incentive. Een tier-dependent premium zou de
// fee-calculator onnodig complex maken.
//
// Reserve-systeem (Fase 30): koper-reserve gaat over `total = bid + premium`,
// niet over `bid` alleen. Dat past bij wat de koper uiteindelijk moet kunnen
// ophoesten als hij de veiling wint.

export const AUCTION_BUYER_PREMIUM_RATE = 0.029;

export interface BidFees {
  bid: number;
  premium: number;
  total: number;
}

export function calculateBidFees(bidAmount: number): BidFees {
  const premium = Math.round(bidAmount * AUCTION_BUYER_PREMIUM_RATE * 100) / 100;
  const total = Math.round((bidAmount + premium) * 100) / 100;
  return { bid: bidAmount, premium, total };
}

// Helper voor reserve-berekening — maakt het eenvoudig om bestaande callers
// die `0.10 * bid` deden te herwerken naar `0.10 * total` zonder de math
// inline opnieuw te schrijven.
export function calculateBidTotalFromBid(bidAmount: number): number {
  return calculateBidFees(bidAmount).total;
}
