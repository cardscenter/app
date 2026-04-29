import { prisma } from "@/lib/prisma";

/**
 * Returns the set of user IDs that the given user can no longer interact
 * with — symmetrically. Both "I blocked them" and "they blocked me" rows
 * count, so listings/conversations stay hidden on both sides regardless of
 * who pulled the trigger.
 *
 * Returns an empty Set when userId is null/undefined (anonymous visitor —
 * nothing to filter).
 */
export async function getBlockedUserIds(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerId === userId) ids.add(r.blockedId);
    if (r.blockedId === userId) ids.add(r.blockerId);
  }
  return ids;
}

/**
 * Tiny helper: builds a Prisma `notIn` clause for sellerId-style filters.
 * Returns undefined if there's nothing to filter — handy in conditional
 * spread inside `where: { ...blockFilter() }`.
 */
export function sellerNotInBlockedFilter(blocked: Set<string>) {
  if (blocked.size === 0) return undefined;
  return { notIn: Array.from(blocked) };
}

export const REPORT_REASONS = [
  "SCAM",
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE",
  "FAKE_LISTING",
  "OTHER",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
