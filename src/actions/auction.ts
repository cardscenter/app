"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuctionSchema } from "@/lib/validations/auction";
import { checkAuctionLimit } from "@/lib/account-limits";
import { getMinimumNextBid, ANTI_SNIPE_MINUTES, ANTI_SNIPE_EXTENSION_MINUTES } from "@/lib/auction/bid-increments";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { resolveAutoBids } from "@/lib/auction/autobid";
import { createNotification } from "@/actions/notification";
import { getAvailableBalance, calculateReserveAmount, syncReservedBalance } from "@/lib/balance-check";
import { calculateAuctionUpsellCost } from "@/lib/upsell-config";
import { generateOrderNumber } from "@/lib/order-number";
import { redirect } from "next/navigation";
import type { UpsellType } from "@/types";

export async function createAuction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const limit = await checkAuctionLimit(session.user.id);
  if (!limit.allowed) {
    return { error: `Je hebt het maximum aantal actieve veilingen bereikt (${limit.max})` };
  }

  const imageUrls = formData.get("imageUrls") as string | null;

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    auctionType: formData.get("auctionType"),
    cardName: formData.get("cardName") || undefined,
    condition: formData.get("condition") || undefined,
    estimatedCardCount: formData.get("estimatedCardCount") || undefined,
    conditionRange: formData.get("conditionRange") || undefined,
    productType: formData.get("productType") || undefined,
    itemCategory: formData.get("itemCategory") || undefined,
    startingBid: formData.get("startingBid"),
    reservePrice: formData.get("reservePrice") || undefined,
    buyNowPrice: formData.get("buyNowPrice") || undefined,
    duration: formData.get("duration"),
    upsells: formData.get("upsells") || undefined,
  };

  const result = createAuctionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;
  const endTime = new Date();
  endTime.setDate(endTime.getDate() + data.duration);

  // Parse upsells and calculate total cost
  let upsellEntries: { type: UpsellType; days: number }[] = [];
  let totalUpsellCost = 0;

  if (data.upsells) {
    try {
      upsellEntries = JSON.parse(data.upsells) as { type: UpsellType; days: number }[];
      const seller = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true, reservedBalance: true, accountType: true },
      });
      const accountType = seller?.accountType ?? "FREE";
      totalUpsellCost = upsellEntries.reduce(
        (sum, entry) => sum + calculateAuctionUpsellCost(entry.type as UpsellType, entry.days, accountType),
        0
      );
      const availableBalance = (seller?.balance ?? 0) - (seller?.reservedBalance ?? 0);
      if (totalUpsellCost > availableBalance) {
        return { error: "Onvoldoende saldo voor promotie-opties" };
      }
    } catch {
      // Invalid JSON, skip upsells
      upsellEntries = [];
    }
  }

  const auction = await prisma.auction.create({
    data: {
      title: data.title,
      description: data.description,
      imageUrls: imageUrls || null,
      auctionType: data.auctionType,
      cardName: data.cardName,
      condition: data.condition,
      estimatedCardCount: data.estimatedCardCount || null,
      conditionRange: data.conditionRange || null,
      productType: data.productType || null,
      itemCategory: data.itemCategory || null,
      sellerId: session.user.id,
      startingBid: data.startingBid,
      reservePrice: data.reservePrice || null,
      buyNowPrice: data.buyNowPrice || null,
      duration: data.duration,
      endTime,
    },
  });

  // Create upsell records and deduct balance
  if (upsellEntries.length > 0 && totalUpsellCost > 0) {
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true },
    });
    const accountType = seller?.accountType ?? "FREE";

    for (const entry of upsellEntries) {
      const cost = calculateAuctionUpsellCost(entry.type as UpsellType, entry.days, accountType);
      const startsAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + entry.days);

      await prisma.auctionUpsell.create({
        data: {
          auctionId: auction.id,
          type: entry.type,
          startsAt,
          expiresAt,
          dailyCost: cost / entry.days,
          totalCost: cost,
        },
      });
    }

    await deductBalance(
      session.user.id,
      totalUpsellCost,
      "UPSELL",
      `Promotie-opties veiling: ${data.title}`,
      auction.id
    );
  }

  return { success: true, auctionId: auction.id };
}

export async function placeBid(auctionId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet bieden op je eigen veiling" };
  if (new Date() > auction.endTime) return { error: "Veiling is afgelopen" };

  // Check minimum bid
  const currentBid = auction.currentBid ?? 0;
  const minimumBid = currentBid === 0 ? auction.startingBid : getMinimumNextBid(currentBid);
  if (amount < minimumBid) {
    return { error: `Minimaal bod is €${minimumBid.toFixed(2)}` };
  }

  // Block self-outbidding
  const previousHighestBid = await prisma.auctionBid.findFirst({
    where: { auctionId },
    orderBy: { amount: "desc" },
  });
  if (previousHighestBid && previousHighestBid.bidderId === session.user.id) {
    return { error: "Je bent al de hoogste bieder" };
  }

  // Check available balance (40% reserve model)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || getAvailableBalance(user) < calculateReserveAmount(amount)) {
    return { error: "Onvoldoende saldo" };
  }

  // Create bid record (no balance deduction — only reserves)
  await prisma.auctionBid.create({
    data: { auctionId, bidderId: session.user.id, amount },
  });

  // Sync reserved balance for new bidder
  await syncReservedBalance(session.user.id);

  // Release reserve for previous highest bidder (their bid is no longer winning)
  if (previousHighestBid) {
    await syncReservedBalance(previousHighestBid.bidderId);
  }

  // Anti-snipe: extend if bid in last 2 minutes
  let newEndTime = auction.endTime;
  const timeLeft = auction.endTime.getTime() - Date.now();
  if (timeLeft < ANTI_SNIPE_MINUTES * 60 * 1000) {
    newEndTime = new Date(auction.endTime.getTime() + ANTI_SNIPE_EXTENSION_MINUTES * 60 * 1000);
  }

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      currentBid: amount,
      endTime: newEndTime,
      extendedCount: newEndTime !== auction.endTime ? { increment: 1 } : undefined,
    },
  });

  // Remove buy now option when bids reach 75% of buy now price
  if (auction.buyNowPrice && amount >= auction.buyNowPrice * 0.75) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { buyNowPrice: null },
    });
  }

  // Notify previous bidder they've been outbid (before autobid resolution)
  if (previousHighestBid && previousHighestBid.bidderId !== session.user.id) {
    await createNotification(
      previousHighestBid.bidderId,
      "OUTBID",
      "Je bent overboden!",
      `Je bod van €${previousHighestBid.amount.toFixed(2)} op "${auction.title}" is overboden.`,
      `/nl/veilingen/${auctionId}`
    );
  }

  // Resolve autobids — other users' autobids may outbid this manual bid
  const result = await resolveAutoBids(auctionId, amount, session.user.id);

  // Update auction with final bid after autobid resolution
  if (result.finalBid !== amount) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { currentBid: result.finalBid },
    });
  }

  return { success: true };
}

export async function buyNow(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (!auction.buyNowPrice) return { error: "Direct kopen is niet beschikbaar" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet je eigen veiling kopen" };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const available = getAvailableBalance(user);
  const reserveNeeded = calculateReserveAmount(auction.buyNowPrice);

  // Need at least 40% to proceed
  if (available < reserveNeeded) {
    return { error: `Onvoldoende saldo. Je hebt minimaal €${reserveNeeded.toFixed(2)} (40%) nodig.` };
  }

  // Release reserves for ALL other bidders on this auction
  const allBidderIds = await prisma.auctionBid.findMany({
    where: { auctionId },
    select: { bidderId: true },
    distinct: ["bidderId"],
  });

  if (available >= auction.buyNowPrice) {
    // Full payment — immediate purchase
    await deductBalance(session.user.id, auction.buyNowPrice, "PURCHASE", `Direct gekocht: ${auction.title}`, auctionId);
    await escrowCredit(auction.sellerId, auction.buyNowPrice, `Verkocht (direct kopen): ${auction.title}`);

    // Check buyer has address for shipping bundle
    const hasAddress = user.street && user.postalCode && user.city;

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "BOUGHT_NOW",
        winnerId: session.user.id,
        finalPrice: auction.buyNowPrice,
        paymentStatus: "PAID",
      },
    });

    // Create ShippingBundle if address available
    if (hasAddress) {
      await prisma.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: session.user.id,
          sellerId: auction.sellerId,
          shippingCost: 0,
          totalItemCost: auction.buyNowPrice,
          totalCost: auction.buyNowPrice,
          status: "PAID",
          auctionId,
          buyerStreet: user.street!,
          buyerHouseNumber: user.houseNumber,
          buyerPostalCode: user.postalCode!,
          buyerCity: user.city!,
          buyerCountry: user.country,
        },
      });
    }

    // Notify seller about buy-now sale
    await createNotification(
      auction.sellerId,
      "ORDER_PAID",
      "Veiling direct gekocht!",
      `"${auction.title}" is direct gekocht voor €${auction.buyNowPrice.toFixed(2)}. Bekijk je verkopen om te verzenden.`,
      "/dashboard/verkopen"
    );
  } else {
    // Partial payment — reserve 40%, give 5-day deadline
    const paymentDeadline = new Date();
    paymentDeadline.setDate(paymentDeadline.getDate() + 5);

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "BOUGHT_NOW",
        winnerId: session.user.id,
        finalPrice: auction.buyNowPrice,
        paymentStatus: "AWAITING_PAYMENT",
        paymentDeadline,
      },
    });

    // Reserve 40% by creating a bid record so syncReservedBalance picks it up
    await prisma.auctionBid.create({
      data: { auctionId, bidderId: session.user.id, amount: auction.buyNowPrice },
    });
    await syncReservedBalance(session.user.id);

    await createNotification(
      session.user.id,
      "AUCTION_WIN",
      "Direct gekocht — betaling vereist",
      `Je hebt "${auction.title}" direct gekocht voor €${auction.buyNowPrice.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
      `/nl/dashboard/biedingen`
    );
  }

  // Release reserves for all other bidders
  for (const { bidderId } of allBidderIds) {
    if (bidderId !== session.user.id) {
      await syncReservedBalance(bidderId);
    }
  }

  return { success: true };
}

export async function finalizeAuction(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });

  if (!auction || auction.status !== "ACTIVE") return;
  if (new Date() < auction.endTime) return;

  // Release reserves for ALL bidders on this auction
  const allBidderIds = await prisma.auctionBid.findMany({
    where: { auctionId },
    select: { bidderId: true },
    distinct: ["bidderId"],
  });
  for (const { bidderId } of allBidderIds) {
    await syncReservedBalance(bidderId);
  }

  if (auction.bids.length === 0) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "ENDED_NO_BIDS" },
    });
    return;
  }

  const highestBid = auction.bids[0];

  if (auction.reservePrice && highestBid.amount < auction.reservePrice) {
    // Reserve not met — no payment needed (40% reserve model, no actual deduction was made)
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "ENDED_RESERVE_NOT_MET" },
    });
    return;
  }

  // Auction sold — try to collect full payment from winner
  const winner = await prisma.user.findUnique({ where: { id: highestBid.bidderId } });
  const totalCost = highestBid.amount;

  if (winner && winner.balance >= totalCost) {
    // Winner has enough balance — deduct full amount and escrow to seller
    await deductBalance(
      highestBid.bidderId,
      totalCost,
      "AUCTION_WIN",
      `Veiling gewonnen: ${auction.title}`,
      auctionId
    );

    await escrowCredit(
      auction.sellerId,
      totalCost,
      `Veiling verkocht (escrow): ${auction.title}`
    );

    // Create ShippingBundle if winner has address
    if (winner.street && winner.postalCode && winner.city) {
      await prisma.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: highestBid.bidderId,
          sellerId: auction.sellerId,
          shippingCost: 0,
          totalItemCost: totalCost,
          totalCost,
          status: "PAID",
          auctionId,
          buyerStreet: winner.street,
          buyerHouseNumber: winner.houseNumber,
          buyerPostalCode: winner.postalCode,
          buyerCity: winner.city,
          buyerCountry: winner.country,
        },
      });
    }

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "ENDED_SOLD",
        winnerId: highestBid.bidderId,
        finalPrice: totalCost,
        paymentStatus: "PAID",
      },
    });

    // Notify seller about auction sale
    await createNotification(
      auction.sellerId,
      "ORDER_PAID",
      "Veiling verkocht!",
      `"${auction.title}" is verkocht voor €${totalCost.toFixed(2)}. Bekijk je verkopen om te verzenden.`,
      "/dashboard/verkopen"
    );
  } else {
    // Winner doesn't have enough balance — set AWAITING_PAYMENT with 5-day deadline
    const paymentDeadline = new Date();
    paymentDeadline.setDate(paymentDeadline.getDate() + 5);

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "ENDED_SOLD",
        winnerId: highestBid.bidderId,
        finalPrice: totalCost,
        paymentStatus: "AWAITING_PAYMENT",
        paymentDeadline,
      },
    });

    // Notify winner they need to pay
    await createNotification(
      highestBid.bidderId,
      "OUTBID",
      "Veiling gewonnen — betaling vereist",
      `Je hebt "${auction.title}" gewonnen voor €${totalCost.toFixed(2)}. Betaal binnen 5 dagen.`,
      `/nl/veilingen/${auctionId}`
    );
  }
}

// ============================================================
// AUTOBID
// ============================================================

export async function setAutoBid(auctionId: string, maxAmount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet bieden op je eigen veiling" };
  if (new Date() > auction.endTime) return { error: "Veiling is afgelopen" };

  const currentBid = auction.currentBid ?? 0;
  const minimumBid = currentBid === 0 ? auction.startingBid : getMinimumNextBid(currentBid);
  if (maxAmount < minimumBid) {
    return { error: `Maximum autobied moet minimaal €${minimumBid.toFixed(2)} zijn` };
  }

  // Check available balance (40% of max autobid amount)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || getAvailableBalance(user) < calculateReserveAmount(maxAmount)) {
    return { error: "Onvoldoende saldo" };
  }

  await prisma.autoBid.upsert({
    where: { userId_auctionId: { userId: session.user.id, auctionId } },
    create: { userId: session.user.id, auctionId, maxAmount, isActive: true },
    update: { maxAmount, isActive: true },
  });

  // If there's no current bid yet, or current highest bidder is someone else,
  // place an initial bid at minimum to activate
  const highestBid = await prisma.auctionBid.findFirst({
    where: { auctionId },
    orderBy: { amount: "desc" },
  });

  if (!highestBid || highestBid.bidderId !== session.user.id) {
    // Place a minimum bid to start the autobid process
    const bidResult = await placeBid(auctionId, minimumBid);
    if (bidResult?.error) return bidResult;
  }

  return { success: true };
}

export async function getAutoBid(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.autoBid.findUnique({
    where: { userId_auctionId: { userId: session.user.id, auctionId } },
  });
}

export async function cancelAutoBid(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.autoBid.updateMany({
    where: { userId: session.user.id, auctionId },
    data: { isActive: false },
  });

  // Recalculate reserved balance after deactivating autobid
  await syncReservedBalance(session.user.id);

  return { success: true };
}

// ============================================================
// COMPLETE AUCTION PAYMENT (for winners with AWAITING_PAYMENT)
// ============================================================

export async function completeAuctionPayment(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { shippingMethods: true },
  });

  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.winnerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (auction.paymentStatus !== "AWAITING_PAYMENT") return { error: "Geen openstaande betaling" };

  // Check deadline
  if (auction.paymentDeadline && new Date() > auction.paymentDeadline) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { paymentStatus: "PAYMENT_FAILED", status: "PAYMENT_FAILED" },
    });
    return { error: "De betalingsdeadline is verlopen" };
  }

  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  const totalCost = auction.finalPrice ?? 0;
  const availableBalance = buyer.balance - buyer.reservedBalance;

  if (availableBalance < totalCost) {
    return { error: `Onvoldoende saldo. Benodigd: €${totalCost.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
  }

  // Check buyer has address
  if (!buyer.street || !buyer.postalCode || !buyer.city) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Deduct from buyer
  await deductBalance(session.user.id, totalCost, "AUCTION_WIN", `Veiling gewonnen: ${auction.title}`, auctionId);

  // Escrow for seller
  await escrowCredit(auction.sellerId, totalCost, `Veiling verkocht (escrow): ${auction.title}`);

  // Create ShippingBundle
  await prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: session.user.id,
      sellerId: auction.sellerId,
      shippingCost: 0,
      totalItemCost: totalCost,
      totalCost,
      status: "PAID",
      auctionId,
      buyerStreet: buyer.street,
      buyerHouseNumber: buyer.houseNumber,
      buyerPostalCode: buyer.postalCode,
      buyerCity: buyer.city,
      buyerCountry: buyer.country,
    },
  });

  // Update auction payment status
  await prisma.auction.update({
    where: { id: auctionId },
    data: { paymentStatus: "PAID" },
  });

  // Notify seller about completed payment
  await createNotification(
    auction.sellerId,
    "ORDER_PAID",
    "Veilingbetaling ontvangen!",
    `De betaling voor "${auction.title}" is voltooid. Bekijk je verkopen om te verzenden.`,
    "/dashboard/verkopen"
  );

  return { success: true };
}
