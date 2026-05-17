// Wallet-helpers die binnen een interactive Prisma-transactie draaien.
//
// Bestaande wallet.ts is "use server" — daar mogen geen non-async exports zijn,
// en `tx`-parameters zijn niet serialiseerbaar voor server-actions. Voor race-
// safe atomic flows (buyNow, placeBid, completeAuctionPayment) hebben we deze
// helpers nodig om alle wallet-mutaties binnen één $transaction te kunnen doen
// samen met de status-flip en bundle-create.
//
// Side-effects (publish realtime events, notifications) horen NIET in deze
// helpers — die roept de caller aan na succesvolle commit van de transactie.

import type { Prisma } from "@prisma/client";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";

type Tx = Prisma.TransactionClient;

const PREMIUM_RATE_LABEL = `${(AUCTION_BUYER_PREMIUM_RATE * 100).toFixed(1).replace(/\.0$/, "")}%`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Trekt bid + premium af van koper-balance + maakt 2 Transaction-rijen
// (PURCHASE + AUCTION_PREMIUM). Faalt met "INSUFFICIENT_BALANCE" als koper
// niet genoeg saldo heeft op het moment van uitvoering. Retourneert nieuwe
// balance.
export async function deductBidPaymentInTx(
  tx: Tx,
  userId: string,
  bidAmount: number,
  premiumAmount: number,
  description: string,
  relatedAuctionId: string,
): Promise<number> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const total = bidAmount + premiumAmount;
  if (user.balance < total) throw new Error("INSUFFICIENT_BALANCE");

  const balanceBefore = user.balance;
  const afterBid = round2(balanceBefore - bidAmount);
  const afterTotal = round2(balanceBefore - total);

  await tx.user.update({
    where: { id: userId },
    data: { balance: afterTotal },
  });

  await tx.transaction.create({
    data: {
      userId,
      type: "PURCHASE",
      amount: -bidAmount,
      balanceBefore,
      balanceAfter: afterBid,
      description,
      relatedAuctionId,
    },
  });

  if (premiumAmount > 0) {
    await tx.transaction.create({
      data: {
        userId,
        type: "AUCTION_PREMIUM",
        amount: -premiumAmount,
        balanceBefore: afterBid,
        balanceAfter: afterTotal,
        description: `Veilingkosten ${PREMIUM_RATE_LABEL}: ${description}`,
        relatedAuctionId,
      },
    });
  }

  return afterTotal;
}

// Credit het bedrag in seller's heldBalance (escrow) + maakt ESCROW_HOLD
// Transaction-rij. Balance wijzigt niet — alleen heldBalance.
export async function escrowCreditInTx(
  tx: Tx,
  userId: string,
  amount: number,
  description: string,
  relatedShippingBundleId?: string,
): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  await tx.user.update({
    where: { id: userId },
    data: { heldBalance: { increment: amount } },
  });

  await tx.transaction.create({
    data: {
      userId,
      type: "ESCROW_HOLD",
      amount,
      balanceBefore: user.balance,
      balanceAfter: user.balance,
      description,
      relatedShippingBundleId,
    },
  });
}
