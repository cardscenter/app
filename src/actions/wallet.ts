"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommissionRate } from "@/lib/subscription-tiers";
import { logAdminAction } from "@/lib/admin-audit";
import { publish, userChannel } from "@/lib/realtime";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";
import { createNotification } from "@/actions/notification";
import { normalizeIban } from "@/lib/validations/iban";
import { settlePendingFees } from "@/lib/pending-fees";

const PREMIUM_RATE_LABEL = `${(AUCTION_BUYER_PREMIUM_RATE * 100).toFixed(1).replace(/\.0$/, "")}%`;

function withSettlementSuffix(description: string, settledTotal: number): string {
  if (settledTotal <= 0.0001) return description;
  return `${description} (€${settledTotal.toFixed(2)} verrekend met openstaande platformkosten)`;
}

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

  const { remaining, settledTotal } = await settlePendingFees(userId, amount);

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + remaining;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount: remaining,
        balanceBefore,
        balanceAfter,
        description: withSettlementSuffix(
          description ?? `Storting €${amount.toFixed(2)}`,
          settledTotal,
        ),
      },
    }),
  ]);

  publish(userChannel(userId), { type: "balance-changed", payload: {} });

  return { success: true, newBalance: balanceAfter };
}

// Admin action: confirm a bank transfer deposit
//
// Fase 32: optioneel `senderIban` — als admin de IBAN invult waarmee de user
// betaalde, vergelijken we die met `User.iban`. Bij match flippen we
// `isIbanVerified=true` (trust-signal). Mismatch geeft geen fout — de storting
// wordt sowieso bevestigd, alleen het IBAN-trust-badge blijft uit.
export async function confirmBankTransfer(
  userId: string,
  amount: number,
  adminNote?: string,
  senderIban?: string,
) {
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

  const { remaining, settledTotal } = await settlePendingFees(userId, amount);

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + remaining;

  // Fase 32: IBAN-match — alleen als admin een sender-IBAN invulde én user
  // een eigen IBAN op profiel heeft staan. Genormaliseerd vergelijken
  // (hoofdletters, geen spaties).
  const ibanMatch =
    senderIban && user.iban
      ? normalizeIban(senderIban) === normalizeIban(user.iban)
      : false;
  const shouldFlipIbanVerified = ibanMatch && !user.isIbanVerified;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: shouldFlipIbanVerified
        ? { balance: balanceAfter, isIbanVerified: true }
        : { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount: remaining,
        balanceBefore,
        balanceAfter,
        description: withSettlementSuffix(
          adminNote
            ? `Bankoverschrijving bevestigd: €${amount.toFixed(2)} (${adminNote})`
            : `Bankoverschrijving bevestigd: €${amount.toFixed(2)}`,
          settledTotal,
        ),
      },
    }),
  ]);

  await logAdminAction({
    adminId: session.user.id,
    action: "CONFIRM_BANK_TRANSFER",
    targetType: "USER",
    targetId: userId,
    metadata: {
      amount,
      adminNote: adminNote ?? null,
      userName: user.displayName,
      bankTransferReference: user.bankTransferReference,
      senderIban: senderIban ?? null,
      ibanMatch,
      ibanVerifiedFlipped: shouldFlipIbanVerified,
    },
  });

  // Fase 32: bij IBAN-flip ook een notificatie naar de user
  if (shouldFlipIbanVerified) {
    await createNotification(
      userId,
      "VERIFICATION_APPROVED",
      "Rekeningnummer geverifieerd!",
      "Je IBAN is geverifieerd via je laatste bankstorting. Het rekeningnummer-trust-badge is nu zichtbaar op je profiel.",
      "/nl/dashboard/verificatie",
    );
  }

  publish(userChannel(userId), { type: "balance-changed", payload: {} });
  if (shouldFlipIbanVerified) {
    publish(userChannel(userId), { type: "verification-changed", payload: { status: "APPROVED" } });
  }

  return { success: true, newBalance: balanceAfter, ibanVerified: shouldFlipIbanVerified };
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

  publish(userChannel(userId), { type: "balance-changed", payload: {} });

  return balanceAfter;
}

// Auction-specific: deduct buyer payment for an auction win, splitting the
// total into a PURCHASE-leg (bid) and an AUCTION_PREMIUM-leg (buyer's
// premium, Fase 31). Both legs hit the buyer's balance; only the PURCHASE
// portion ends up in seller-escrow via separate escrowCredit. The premium
// goes to the platform as fee revenue.
//
// Returnt het uiteindelijke balance-saldo na beide deductions zodat callers
// het kunnen gebruiken voor logging.
export async function deductBidPayment(
  userId: string,
  bidAmount: number,
  premiumAmount: number,
  description: string,
  relatedAuctionId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const total = bidAmount + premiumAmount;
  if (user.balance < total) throw new Error("Insufficient balance for bid + premium");

  const balanceBefore = user.balance;
  const afterBid = Math.round((balanceBefore - bidAmount) * 100) / 100;
  const afterTotal = Math.round((balanceBefore - total) * 100) / 100;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: afterTotal },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "PURCHASE",
        amount: -bidAmount,
        balanceBefore,
        balanceAfter: afterBid,
        description,
        relatedAuctionId,
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "AUCTION_PREMIUM",
        amount: -premiumAmount,
        balanceBefore: afterBid,
        balanceAfter: afterTotal,
        description: `Veilingkosten ${PREMIUM_RATE_LABEL}: ${description}`,
        relatedAuctionId,
      },
    }),
  ]);

  publish(userChannel(userId), { type: "balance-changed", payload: {} });

  return afterTotal;
}

// Refund the buyer's premium for an auction (Fase 31). Aangeroepen
// vanuit volledige-refund-paden (auto-cancel-stale-paid, dispute met
// BUYER-decision, respondToCancellation ACCEPT) wanneer een auction-bundle
// helemaal teruggedraaid wordt. Premium ging via deductBidPayment naar
// platform; bij volledige cancel hoort die ook terug naar koper.
//
// Idempotent: checkt of er al een AUCTION_PREMIUM_REFUND-Transaction
// bestaat voor deze buyer+auction; skip als ja. Veilig om meermaals aan
// te roepen vanuit retry-cron of dubbele cancel-flows.
//
// NIET aangeroepen voor partial-refund-paden (PARTIAL dispute-decision,
// seller-initiated issueSellerRefund) — premium is platform-fee voor de
// auction-faciliteit en blijft bij gedeeltelijke refund staan.
export async function refundAuctionPremium(buyerId: string, auctionId: string) {
  // Vind de originele AUCTION_PREMIUM Transaction (negatief bedrag = afgeschreven)
  const premiumTx = await prisma.transaction.findFirst({
    where: { userId: buyerId, type: "AUCTION_PREMIUM", relatedAuctionId: auctionId },
    orderBy: { createdAt: "asc" },
  });
  if (!premiumTx) {
    // Geen premium afgeschreven (bv. legacy bundle van vóór Fase 31, of
    // off-platform pickup). Niets te refunden.
    return { refunded: 0 };
  }

  // Idempotency-check: bestaat er al een refund voor deze buyer+auction?
  const existingRefund = await prisma.transaction.findFirst({
    where: { userId: buyerId, type: "AUCTION_PREMIUM_REFUND", relatedAuctionId: auctionId },
  });
  if (existingRefund) {
    return { refunded: 0, alreadyRefunded: true };
  }

  const refundAmount = Math.abs(premiumTx.amount); // amount was negatief
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error("Buyer not found");

  // Audit-fix: settlement vóór credit zodat een wanbetaler-met-schuld de
  // PendingPlatformFee niet kan ontwijken via een premium-refund van een
  // andere auction. FIFO-afroming op alle open fees.
  const { remaining, settledTotal } = await settlePendingFees(buyerId, refundAmount);

  const balanceBefore = buyer.balance;
  const balanceAfter = Math.round((balanceBefore + remaining) * 100) / 100;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: buyerId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId: buyerId,
        type: "AUCTION_PREMIUM_REFUND",
        amount: remaining,
        balanceBefore,
        balanceAfter,
        description: withSettlementSuffix(
          `Veilingkosten teruggestort: ${premiumTx.description.replace(/^Veilingkosten \d+(?:[.,]\d+)?%: /, "")}`,
          settledTotal,
        ),
        relatedAuctionId: auctionId,
      },
    }),
  ]);

  publish(userChannel(buyerId), { type: "balance-changed", payload: {} });

  return { refunded: refundAmount };
}

// Internal: credit balance (used when seller receives payment)
export async function creditBalance(userId: string, amount: number, type: string, description: string, relatedAuctionId?: string, relatedClaimsaleItemId?: string) {
  const { remaining, settledTotal } = await settlePendingFees(userId, amount);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + remaining;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type,
        amount: remaining,
        balanceBefore,
        balanceAfter,
        description: withSettlementSuffix(description, settledTotal),
        relatedAuctionId,
        relatedClaimsaleItemId,
      },
    }),
  ]);

  publish(userChannel(userId), { type: "balance-changed", payload: {} });

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
// Commission is deducted from seller based on their account tier.
//
// `amount` = totaal bedrag dat uit heldBalance vrijkomt (items + verzending).
// `commissionableAmount` = portie waarover commissie geheven wordt (alleen items).
//   Default = werkelijk-vrijgekomen escrow (Fase 32: was `amount`; veranderd
//   zodat shortfall-paden niet meer commissie-base krijgen dan er beschikbaar
//   was). Nieuwe callers (Fase 28) geven beide expliciet.
//
// **Fase 32 shortfall-clamp**: als heldBalance < amount, dan wordt zowel de
// escrow-decrement, de commissie-base als `sellerReceives` geclampt op de
// werkelijk vrijgekomen pot. Voorheen kreeg seller `amount - commissie`
// ongeacht de hold — dat was "geld uit het niets" bij data-corruptie.
export async function releaseEscrow(userId: string, amount: number, description: string, relatedShippingBundleId?: string, commissionableAmount?: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const commissionRate = getCommissionRate(user.accountType);

  // Clamp escrow-decrement op heldBalance ≥ 0. Negatief escrow betekent dat
  // er meer is uitbetaald dan vastgehouden — een data-inconsistentie. We
  // loggen het zodat het zichtbaar wordt en verwerken zo veel mogelijk.
  const safeEscrowDecrement = Math.min(amount, Math.max(user.heldBalance, 0));
  if (safeEscrowDecrement < amount) {
    console.error(
      `[releaseEscrow] heldBalance shortfall for user ${userId}: trying to release €${amount.toFixed(2)} but only €${user.heldBalance.toFixed(2)} held. Bundle: ${relatedShippingBundleId ?? "n/a"}. Seller credit clamped to actual hold (Fase 32).`,
    );
  }

  // Fase 32: clamp sellerReceives + commission op werkelijk vrijgekomen
  // escrow. Vóór deze fix kreeg seller `amount - commissie` ook bij een
  // shortfall — dat is "geld uit het niets" want de heldBalance had die
  // bedragen niet. Nu: commissie over min(commissionableAmount,
  // actualReleased) en sellerReceives = actualReleased - commissie.
  const actualReleased = safeEscrowDecrement;
  const commissionBase = Math.min(commissionableAmount ?? actualReleased, actualReleased);
  const commissionAmount = Math.round(commissionBase * commissionRate * 100) / 100;
  const sellerReceives = Math.round((actualReleased - commissionAmount) * 100) / 100;

  const { remaining: creditAmount, settledTotal } = await settlePendingFees(
    userId,
    sellerReceives,
  );

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + creditAmount;

  const operations = [
    prisma.user.update({
      where: { id: userId },
      data: {
        balance: balanceAfter,
        heldBalance: { decrement: safeEscrowDecrement },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "SALE",
        amount: creditAmount,
        balanceBefore,
        balanceAfter,
        description: withSettlementSuffix(description, settledTotal),
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

  publish(userChannel(userId), { type: "balance-changed", payload: {} });
}

// Internal: partial refund escrow → return partial funds to buyer, keep rest in escrow
export async function partialRefundEscrow(sellerId: string, buyerId: string, refundAmount: number, escrowDeduction: number, description: string, relatedShippingBundleId?: string) {
  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerId } }),
    prisma.user.findUnique({ where: { id: sellerId } }),
  ]);
  if (!buyer) throw new Error("Buyer not found");
  if (!seller) throw new Error("Seller not found");

  // Ensure escrow deduction doesn't exceed held balance
  const safeEscrowDeduction = Math.min(escrowDeduction, Math.max(seller.heldBalance, 0));

  const { remaining: buyerCredit, settledTotal: buyerSettled } = await settlePendingFees(
    buyerId,
    refundAmount,
  );

  const buyerBalanceBefore = buyer.balance;
  const buyerBalanceAfter = buyerBalanceBefore + buyerCredit;

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
        amount: buyerCredit,
        balanceBefore: buyerBalanceBefore,
        balanceAfter: buyerBalanceAfter,
        description: withSettlementSuffix(
          `Gedeeltelijke terugbetaling: ${description}`,
          buyerSettled,
        ),
        relatedShippingBundleId,
      },
    }),
    // Reduce seller's held balance by escrow deduction amount (never below 0)
    prisma.user.update({
      where: { id: sellerId },
      data: { heldBalance: { decrement: safeEscrowDeduction } },
    }),
  ]);

  publish(userChannel(buyerId), { type: "balance-changed", payload: {} });
  publish(userChannel(sellerId), { type: "balance-changed", payload: {} });
}

// Internal: refund escrow → return funds to buyer, reduce seller heldBalance
export async function refundEscrow(sellerId: string, buyerId: string, amount: number, sellerItemAmount: number, description: string, relatedShippingBundleId?: string) {
  const [buyer, seller] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerId } }),
    prisma.user.findUnique({ where: { id: sellerId } }),
  ]);
  if (!buyer) throw new Error("Buyer not found");
  if (!seller) throw new Error("Seller not found");

  // Clamp escrow-decrement op heldBalance ≥ 0 — zelfde safety-net als bij
  // releaseEscrow en partialRefundEscrow. Buyer wordt nog steeds volledig
  // gerefund, maar de heldBalance-decrement wordt niet groter dan beschikbaar.
  const safeEscrowDecrement = Math.min(sellerItemAmount, Math.max(seller.heldBalance, 0));
  if (safeEscrowDecrement < sellerItemAmount) {
    console.error(
      `[refundEscrow] heldBalance shortfall for seller ${sellerId}: trying to release €${sellerItemAmount.toFixed(2)} but only €${seller.heldBalance.toFixed(2)} held. Bundle: ${relatedShippingBundleId ?? "n/a"}. Buyer refund still processed fully.`,
    );
  }

  const { remaining: buyerCredit, settledTotal: buyerSettled } = await settlePendingFees(
    buyerId,
    amount,
  );

  const buyerBalanceBefore = buyer.balance;
  const buyerBalanceAfter = buyerBalanceBefore + buyerCredit;

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
        amount: buyerCredit,
        balanceBefore: buyerBalanceBefore,
        balanceAfter: buyerBalanceAfter,
        description: withSettlementSuffix(`Terugbetaling: ${description}`, buyerSettled),
        relatedShippingBundleId,
      },
    }),
    // Reduce seller's held balance — clamped op 0
    prisma.user.update({
      where: { id: sellerId },
      data: { heldBalance: { decrement: safeEscrowDecrement } },
    }),
  ]);

  publish(userChannel(buyerId), { type: "balance-changed", payload: {} });
  publish(userChannel(sellerId), { type: "balance-changed", payload: {} });
}
