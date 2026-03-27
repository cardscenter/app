"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// Internal: deduct balance (used by auction/claimsale purchases)
export async function deductBalance(userId: string, amount: number, type: string, description: string, relatedAuctionId?: string, relatedClaimsaleItemId?: string, relatedListingId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.balance < amount) throw new Error("Insufficient balance");

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
