export function getMinimumIncrement(currentBid: number): number {
  if (currentBid < 1) return 0.1;
  if (currentBid < 5) return 0.25;
  if (currentBid < 10) return 0.5;
  if (currentBid < 50) return 1;
  if (currentBid < 100) return 2.5;
  if (currentBid < 500) return 5;
  return 10;
}

export function getMinimumNextBid(currentBid: number): number {
  return +(currentBid + getMinimumIncrement(currentBid)).toFixed(2);
}

export const AUCTION_DURATIONS = [1, 3, 5, 7] as const;
export type AuctionDuration = (typeof AUCTION_DURATIONS)[number];

export const ANTI_SNIPE_MINUTES = 2;
export const ANTI_SNIPE_EXTENSION_MINUTES = 2;
