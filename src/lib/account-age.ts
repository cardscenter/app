/**
 * Account age restrictions for bidding and purchasing.
 *
 * | Account Age          | Max Amount |
 * |----------------------|------------|
 * | 0-24 hours           | €50        |
 * | 1-7 days             | €200       |
 * | 7+ days (unverified) | €500       |
 * | 7+ days (verified)   | Unlimited  |
 */

// Feature launch date — accounts created before this skip restrictions
const FEATURE_LAUNCH_DATE = new Date("2026-03-31");

type AccountAgeTier = {
  maxAmount: number | null; // null = unlimited
  label: string;
};

const TIERS: { minHours: number; requiresVerification?: boolean; maxAmount: number | null; label: string }[] = [
  { minHours: 0, maxAmount: 50, label: "0-24 uur" },
  { minHours: 24, maxAmount: 200, label: "1-7 dagen" },
  { minHours: 24 * 7, maxAmount: 500, label: "7+ dagen (niet geverifieerd)" },
  { minHours: 24 * 7, requiresVerification: true, maxAmount: null, label: "7+ dagen (geverifieerd)" },
];

export function getAccountAgeTier(createdAt: Date, isVerified: boolean): AccountAgeTier {
  // Accounts created before feature launch — no restrictions
  if (createdAt < FEATURE_LAUNCH_DATE) {
    return { maxAmount: null, label: "Bestaand account" };
  }

  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

  if (ageHours >= 24 * 7 && isVerified) {
    return { maxAmount: null, label: "7+ dagen (geverifieerd)" };
  }
  if (ageHours >= 24 * 7) {
    return { maxAmount: 500, label: "7+ dagen (niet geverifieerd)" };
  }
  if (ageHours >= 24) {
    return { maxAmount: 200, label: "1-7 dagen" };
  }
  return { maxAmount: 50, label: "0-24 uur" };
}

/**
 * Check if a user is allowed to bid/purchase for a given amount.
 * Returns { allowed: true } or { allowed: false, error, limit }.
 */
export function checkAmountAllowed(
  user: { createdAt: Date; isVerified: boolean },
  amount: number
): { allowed: boolean; error?: string; limit?: number } {
  const tier = getAccountAgeTier(user.createdAt, user.isVerified);

  if (tier.maxAmount === null) {
    return { allowed: true };
  }

  if (amount > tier.maxAmount) {
    return {
      allowed: false,
      error: `Je account is te nieuw voor dit bedrag. Maximum: €${tier.maxAmount.toFixed(2)} (${tier.label}).`,
      limit: tier.maxAmount,
    };
  }

  return { allowed: true };
}
