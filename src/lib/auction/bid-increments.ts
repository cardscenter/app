export function getMinimumIncrement(currentBid: number): number {
  if (currentBid < 20) return 1;
  if (currentBid < 50) return 2;
  if (currentBid < 80) return 3;
  if (currentBid < 120) return 4;
  if (currentBid < 200) return 5;
  if (currentBid < 500) return 10;
  if (currentBid < 1000) return 25;
  if (currentBid < 2500) return 50;
  if (currentBid < 5000) return 100;
  return 200;
}

export function getMinimumNextBid(currentBid: number): number {
  return +(currentBid + getMinimumIncrement(currentBid)).toFixed(2);
}

export const AUCTION_DURATIONS = [1, 3, 5, 7] as const;
export type AuctionDuration = (typeof AUCTION_DURATIONS)[number];

export const ANTI_SNIPE_MINUTES = 2;
export const ANTI_SNIPE_EXTENSION_MINUTES = 2;
