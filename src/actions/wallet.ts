"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommissionRate } from "@/lib/subscription-tiers";

// Get current user's balance
export async function getBalance(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });
  return user?.balance ?? null;
}

// Get full balance summary for dashboard
export async function getBalanceSummary() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      reservedBalance: true,
      heldBalance: true,
      bankTransferReference: true,
    },
  });
  if (!user) return null;
  return {
    balance: user.balance,
    reservedBalance: user.reservedBalance,
    availableBalance: Math.max(0, user.balance - user.reservedBalance),
    heldBalance: user.heldBalance,
    bankTransferReference: user.bankTransferReference,
  };
}

// Admin action: manually deposit balance for a user
export async function adminDeposit(userId: string, amount: number, description?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // TODO: Add proper admin check
  if (amount < 15) return { error: "Minimale storting is €15,00" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount,
        balanceBefore,
        balanceAfter,
        description: description ?? `Storting €${amount.toFixed(2)}`,
      },
    }),
  ]);

  return { success: true, newBalance: balanceAfter };
}

// Admin action: confirm a bank transfer deposit
export async function confirmBankTransfer(userId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Verify admin
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return { error: "Niet geautoriseerd" };

  if (amount < 15) return { error: "Minimale storting is €15,00" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount,
        balanceBefore,
        balanceAfter,
        description: `Bankoverschrijving bevestigd: €${amount.toFixed(2)}`,
      },
    }),
  ]);

  return { success: true, newBalance: balanceAfter };
}

// Internal: deduct balance (used by auction/claimsale/listing purchases)
export async function deductBalance(userId: string, amount: number, type: string, description: string, relatedAuctionId?: string, relatedClaimsaleItemId?: string, relatedListingId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const availableBalance = user.balance - user.reservedBalance;
  if (availableBalance < amount && user.balance < amount) throw new Error("Insufficient balance");

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore - amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type,
        amount: -amount,
        balanceBefore,
        balanceAfter,
        description,
        relatedAuctionId,
        relatedClaimsaleItemId,
        relatedListingId,
      },
    }),
  ]);

  return balanceAfter;
}

// Internal: credit balance (used when seller receives payment)
export async function creditBalance(userId: string, amount: number, type: string, description: string, relatedAuctionId?: string, relatedClaimsaleItemId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        relatedAuctionId,
        relatedClaimsaleItemId,
      },
    }),
  ]);

  return balanceAfter;
}

// Internal: credit escrow (hold funds for seller until buyer confirms)
export async function escrowCredit(userId: string, amount: number, description: string, relatedShippingBundleId?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { heldBalance: { increment: amount } },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.transaction.create({
    data: {
      userId,
      type: "ESCROW_HOLD",
      amount,
      balanceBefore: user.balance,
      balanceAfter: user.balance, // balance doesn't change, only heldBalance
      description,
      relatedShippingBundleId,
    },
  });
}

// Internal: release escrow → move heldBalance to balance (delivery confirmed)
// Commission is deducted from seller based on their account tier
export async function releaseEscrow(userId: string, amount: number, description: string, relatedShippingBundleId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const commissionRate = getCommissionRate(user.accountType);
  const commissionAmount = Math.round(amount * commissionRate * 100) / 100;
  const sellerReceives = amount - commissionAmount;

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + sellerReceives;

  const operations = [
    prisma.user.update({
      where: { id: userId },
      data: {
        balance: balanceAfter,
        heldBalance: { decrement: amount },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "SALE",
        amount: sellerReceives,
        balanceBefore,
        balanceAfter,
        description,
        relatedShippingBundleId,
      },
    }),
  ];

  // If there's commission, create a separate transaction
  if (commissionAmount > 0) {
    operations.push(
      prisma.transaction.create({
        data: {
          userId,
          type: "COMMISSION",
          amount: -commissionAmount,
          balanceBefore: balanceAfter,
          balanceAfter,
          description: `Commissie (${(commissionRate * 100).toFixed(1)}%): ${description}`,
          relatedShippingBundleId,
        },
      })
    );
  }

  await prisma.$transaction(operations);
}

// Internal: partial refund escrow → return partial funds to buyer, keep rest in escrow
export async function partialRefundEscrow(sellerId: string, buyerId: string, refundAmount: number, escrowDeduction: number, description: string, relatedShippingBundleId?: string) {
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error("Buyer not found");

  const buyerBalanceBefore = buyer.balance;
  const buyerBalanceAfter = buyerBalanceBefore + refundAmount;

  await prisma.$transaction([
    // Return partial funds to buyer
    prisma.user.update({
      where: { id: buyerId },
      data: { balance: buyerBalanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId: buyerId,
        type: "PURCHASE",
        amount: refundAmount,
        balanceBefore: buyerBalanceBefore,
        balanceAfter: buyerBalanceAfter,
        description: `Gedeeltelijke terugbetaling: ${description}`,
        relatedShippingBundleId,
      },
    }),
    // Reduce seller's held balance by escrow deduction amount
    prisma.user.update({
      where: { id: sellerId },
      data: { heldBalance: { decrement: escrowDeduction } },
    }),
  ]);
}

// Internal: refund escrow → return funds to buyer, reduce seller heldBalance
export async function refundEscrow(sellerId: string, buyerId: string, amount: number, sellerItemAmount: number, description: string, relatedShippingBundleId?: string) {
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error("Buyer not found");

  const buyerBalanceBefore = buyer.balance;
  const buyerBalanceAfter = buyerBalanceBefore + amount;

  await prisma.$transaction([
    // Return funds to buyer
    prisma.user.update({
      where: { id: buyerId },
      data: { balance: buyerBalanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId: buyerId,
        type: "PURCHASE",
        amount,
        balanceBefore: buyerBalanceBefore,
        balanceAfter: buyerBalanceAfter,
        description: `Terugbetaling: ${description}`,
        relatedShippingBundleId,
      },
    }),
    // Reduce seller's held balance
    prisma.user.update({
      where: { id: sellerId },
      data: { heldBalance: { decrement: sellerItemAmount } },
    }),
  ]);
}
