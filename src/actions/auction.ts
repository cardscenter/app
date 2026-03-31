"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuctionSchema } from "@/lib/validations/auction";
import { checkAuctionLimit } from "@/lib/account-limits";
import { getMinimumNextBid, ANTI_SNIPE_MINUTES, ANTI_SNIPE_EXTENSION_MINUTES } from "@/lib/auction/bid-increments";
import { deductBalance, creditBalance, escrowCredit } from "@/actions/wallet";
import { resolveAutoBids } from "@/lib/auction/autobid";
import { createNotification } from "@/actions/notification";
import { redirect } from "next/navigation";

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
    cardSetId: formData.get("cardSetId") || undefined,
    condition: formData.get("condition") || undefined,
    startingBid: formData.get("startingBid"),
    reservePrice: formData.get("reservePrice") || undefined,
    buyNowPrice: formData.get("buyNowPrice") || undefined,
    duration: formData.get("duration"),
  };

  const result = createAuctionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;
  const endTime = new Date();
  endTime.setDate(endTime.getDate() + data.duration);

  const auction = await prisma.auction.create({
    data: {
      title: data.title,
      description: data.description,
      imageUrls: imageUrls || null,
      auctionType: data.auctionType,
      cardName: data.cardName,
      cardSetId: data.cardSetId || null,
      condition: data.condition,
      sellerId: session.user.id,
      startingBid: data.startingBid,
      reservePrice: data.reservePrice || null,
      buyNowPrice: data.buyNowPrice || null,
      duration: data.duration,
      endTime,
    },
  });

  redirect(`/nl/veilingen/${auction.id}`);
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

  // Check balance
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.balance < amount) {
    return { error: "Onvoldoende saldo" };
  }

  // Refund previous highest bidder
  const previousHighestBid = await prisma.auctionBid.findFirst({
    where: { auctionId },
    orderBy: { amount: "desc" },
  });
  if (previousHighestBid && previousHighestBid.bidderId !== session.user.id) {
    await creditBalance(
      previousHighestBid.bidderId,
      previousHighestBid.amount,
      "AUCTION_BID_REFUND",
      `Bod teruggestort: ${auction.title}`,
      auctionId
    );
  }

  // Deduct balance from new bidder
  await deductBalance(session.user.id, amount, "AUCTION_BID", `Bod geplaatst: ${auction.title}`, auctionId);

  // Create bid and update auction
  await prisma.auctionBid.create({
    data: { auctionId, bidderId: session.user.id, amount },
  });

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

  // Remove buy now option after first bid
  if (auction.buyNowPrice && !previousHighestBid) {
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
  if (!user || user.balance < auction.buyNowPrice) {
    return { error: "Onvoldoende saldo" };
  }

  // Refund any existing highest bidder
  const highestBid = await prisma.auctionBid.findFirst({
    where: { auctionId },
    orderBy: { amount: "desc" },
  });
  if (highestBid) {
    await creditBalance(
      highestBid.bidderId,
      highestBid.amount,
      "AUCTION_BID_REFUND",
      `Bod teruggestort (direct kopen): ${auction.title}`,
      auctionId
    );
  }

  // Deduct from buyer
  await deductBalance(session.user.id, auction.buyNowPrice, "PURCHASE", `Direct gekocht: ${auction.title}`, auctionId);

  // Credit seller
  await creditBalance(auction.sellerId, auction.buyNowPrice, "SALE", `Verkocht (direct kopen): ${auction.title}`, auctionId);

  // Update auction
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: "BOUGHT_NOW",
      winnerId: session.user.id,
      finalPrice: auction.buyNowPrice,
    },
  });

  return { success: true };
}

export async function finalizeAuction(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: { orderBy: { amount: "desc" }, take: 1 } },
  });

  if (!auction || auction.status !== "ACTIVE") return;
  if (new Date() < auction.endTime) return;

  if (auction.bids.length === 0) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "ENDED_NO_BIDS" },
    });
    return;
  }

  const highestBid = auction.bids[0];

  if (auction.reservePrice && highestBid.amount < auction.reservePrice) {
    // Reserve not met — refund highest bidder
    await creditBalance(
      highestBid.bidderId,
      highestBid.amount,
      "AUCTION_BID_REFUND",
      `Bod teruggestort (reserveprijs niet behaald): ${auction.title}`,
      auctionId
    );
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "ENDED_RESERVE_NOT_MET" },
    });
    return;
  }

  // Auction sold — credit seller
  await creditBalance(
    auction.sellerId,
    highestBid.amount,
    "SALE",
    `Veiling verkocht: ${auction.title}`,
    auctionId
  );

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: "ENDED_SOLD",
      winnerId: highestBid.bidderId,
      finalPrice: highestBid.amount,
    },
  });
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

  // Check balance
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.balance < minimumBid) {
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

  return { success: true };
}
