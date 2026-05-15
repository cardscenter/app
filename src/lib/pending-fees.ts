import { prisma } from "@/lib/prisma";
import type { Prisma, PendingPlatformFee } from "@prisma/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PendingFeeType = "BID_DEPOSIT_FORFEIT" | "BID_PAYMENT_FAILURE_FEE";

export async function recordPendingFeeInTx(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    type: PendingFeeType;
    shortfallAmount: number;
    originalAmount: number;
    description: string;
    relatedAuctionId?: string;
  },
) {
  if (args.shortfallAmount <= 0.0001) return null;
  return tx.pendingPlatformFee.create({
    data: {
      userId: args.userId,
      type: args.type,
      amount: round2(args.shortfallAmount),
      originalAmount: round2(args.originalAmount),
      description: args.description,
      relatedAuctionId: args.relatedAuctionId,
    },
  });
}

/**
 * Settle as much of `incomingAmount` as possible against the user's open
 * PendingPlatformFee rows (FIFO on createdAt). Returns the amount that's left
 * over after settlement — caller is responsible for crediting that remainder
 * to `User.balance` afterwards (typically via creditBalance).
 *
 * All settlement updates + audit-Transaction-rows happen in a single
 * `prisma.$transaction`. The settlement does NOT mutate `User.balance`
 * itself — it consumes from `incomingAmount`. This means balanceBefore and
 * balanceAfter on the audit-Transaction-row are equal to the user's current
 * balance (the row exists for the user's transaction-history, not as a balance
 * mutation).
 */
export async function settlePendingFees(
  userId: string,
  incomingAmount: number,
): Promise<{
  remaining: number;
  settledTotal: number;
  settledRows: PendingPlatformFee[];
}> {
  if (incomingAmount <= 0) {
    return { remaining: incomingAmount, settledTotal: 0, settledRows: [] };
  }

  // Audit-fix: race-safe settlement. Eerdere implementatie las open fees
  // BUITEN een transaction en update'tte ze daarna — twee parallelle settles
  // konden dezelfde fee dubbel afromen + dubbele PLATFORM_FEE_SETTLEMENT-rij
  // creëren. Nu doen we alles binnen één $transaction(callback) met een
  // conditional updateMany per fee (`WHERE settledAt = null AND amount >=
  // settle`). Bij race-conflict count=0 → skip die fee → continue met de
  // volgende. SQLite serialiseert writes binnen één tx.
  return prisma.$transaction(async (tx) => {
    const open = await tx.pendingPlatformFee.findMany({
      where: { userId, settledAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (open.length === 0) {
      return { remaining: incomingAmount, settledTotal: 0, settledRows: [] };
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) {
      return { remaining: incomingAmount, settledTotal: 0, settledRows: [] };
    }

    let remaining = round2(incomingAmount);
    const settledRows: PendingPlatformFee[] = [];

    for (const fee of open) {
      if (remaining <= 0.0001) break;
      const settle = round2(Math.min(fee.amount, remaining));
      const newAmount = round2(fee.amount - settle);
      const isFullySettled = newAmount <= 0.0001;

      // Conditional update — race-veilig tegen een parallelle settle die deze
      // fee al afroomde. Filter op zowel `settledAt: null` als
      // `amount: { gte: settle }` zodat we niet meer afromen dan er staat.
      const updated = await tx.pendingPlatformFee.updateMany({
        where: {
          id: fee.id,
          settledAt: null,
          amount: { gte: settle },
        },
        data: {
          amount: isFullySettled ? 0 : newAmount,
          settledAt: isFullySettled ? new Date() : null,
        },
      });
      if (updated.count === 0) {
        // Race: parallelle settle heeft 'm al afgeroomd. Skip — onze
        // `remaining` blijft onveranderd zodat de volgende fee 'm krijgt.
        continue;
      }

      await tx.transaction.create({
        data: {
          userId,
          type: "PLATFORM_FEE_SETTLEMENT",
          amount: -settle,
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          description: `Schuld afgelost: ${fee.description}`,
          relatedAuctionId: fee.relatedAuctionId ?? undefined,
        },
      });

      settledRows.push(fee);
      remaining = round2(remaining - settle);
    }

    const settledTotal = round2(incomingAmount - remaining);
    return { remaining, settledTotal, settledRows };
  });
}

export async function getOpenPendingFees(userId: string) {
  return prisma.pendingPlatformFee.findMany({
    where: { userId, settledAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOpenPendingFeesTotal(userId: string): Promise<number> {
  const open = await prisma.pendingPlatformFee.findMany({
    where: { userId, settledAt: null },
    select: { amount: true },
  });
  return round2(open.reduce((sum, f) => sum + f.amount, 0));
}
