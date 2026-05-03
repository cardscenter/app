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
import { createPendingBundle } from "@/lib/shipping-bundle";
import { checkAmountAllowed } from "@/lib/account-age";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";
import { redirect } from "next/navigation";
import type { UpsellType } from "@/types";

export async function createAuction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

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
    tcgdexId: formData.get("tcgdexId") || undefined,
    estimatedCardCount: formData.get("estimatedCardCount") || undefined,
    conditionRange: formData.get("conditionRange") || undefined,
    productType: formData.get("productType") || undefined,
    itemCategory: formData.get("itemCategory") || undefined,
    startingBid: formData.get("startingBid"),
    reservePrice: formData.get("reservePrice") || undefined,
    buyNowPrice: formData.get("buyNowPrice") || undefined,
    duration: formData.get("duration"),
    runnerUpEnabled: formData.get("runnerUpEnabled") || undefined,
    deliveryMethod: formData.get("deliveryMethod") || "SHIP",
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

  // Auto-link cardSetId via TCGdex set mapping when present
  const autoCardSetId = data.tcgdexId ? await resolveLocalCardSetId(data.tcgdexId) : null;

  // Pickup-city auto-fill (Fase 27.95): voor PICKUP/BOTH veilingen vereisen we
  // een ingevulde User.city — anders heeft koper geen idee waar op te halen.
  const isPickupMode = data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH";
  let pickupCity: string | null = null;
  if (isPickupMode) {
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { city: true },
    });
    if (!seller?.city) {
      return { error: "Vul eerst je woonplaats in via Dashboard → Profiel voordat je een ophaal-veiling aanmaakt" };
    }
    pickupCity = seller.city;
  }

  const auction = await prisma.auction.create({
    data: {
      title: data.title,
      description: data.description,
      imageUrls: imageUrls || null,
      auctionType: data.auctionType,
      cardName: data.cardName,
      condition: data.condition,
      tcgdexId: data.tcgdexId || null,
      cardSetId: autoCardSetId,
      estimatedCardCount: data.estimatedCardCount || null,
      conditionRange: data.conditionRange || null,
      productType: data.productType || null,
      itemCategory: data.itemCategory || null,
      sellerId: session.user.id,
      startingBid: data.startingBid,
      reservePrice: data.reservePrice || null,
      buyNowPrice: data.buyNowPrice || null,
      duration: data.duration,
      runnerUpEnabled: data.runnerUpEnabled,
      deliveryMethod: data.deliveryMethod,
      pickupCity,
      endTime,
    },
  });

  // Create shipping method links
  const shippingMethodIdsJson = formData.get("shippingMethodIds") as string | null;
  if (shippingMethodIdsJson) {
    try {
      const shippingMethodIds: string[] = JSON.parse(shippingMethodIdsJson);
      if (shippingMethodIds.length > 0) {
        const methods = await prisma.sellerShippingMethod.findMany({
          where: { id: { in: shippingMethodIds }, sellerId: session.user.id },
        });

        // Validate: must have at least one non-LETTER method
        const hasNonLetter = methods.some((m) => m.shippingType !== "LETTER");
        if (!hasNonLetter) {
          await prisma.auction.delete({ where: { id: auction.id } });
          return { error: "Je moet naast briefpost minimaal één pakket- of brievenbuspakket-optie aanbieden." };
        }

        for (const method of methods) {
          await prisma.auctionShippingMethod.create({
            data: { auctionId: auction.id, shippingMethodId: method.id, price: method.price },
          });
        }
      }
    } catch { /* ignore invalid JSON */ }
  }

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

  // Award Ember for creating a listing (auctions count too)
  const { logActivity: logAuctionActivity } = await import("@/actions/activity");
  logAuctionActivity(session.user.id, "CREATE_LISTING", { auctionId: auction.id });

  return { success: true, auctionId: auction.id };
}

export async function placeBid(auctionId: string, amount: number, deliveryChoice?: "SHIP" | "PICKUP") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet bieden op je eigen veiling" };
  if (new Date() > auction.endTime) return { error: "Veiling is afgelopen" };

  // Delivery-keuze (Fase 27.95): voor BOTH-veilingen moet de bidder kiezen
  // tussen verzenden of ophalen. Wordt opgeslagen op de bid zodat finalize
  // de winner's keuze kan gebruiken voor bundle.deliveryMethod.
  let bidDeliveryChoice: string | null = null;
  if (auction.deliveryMethod === "BOTH") {
    if (!deliveryChoice || (deliveryChoice !== "SHIP" && deliveryChoice !== "PICKUP")) {
      return { error: "Kies of je wilt verzenden of ophalen voordat je biedt" };
    }
    bidDeliveryChoice = deliveryChoice;
  } else if (auction.deliveryMethod === "PICKUP") {
    bidDeliveryChoice = "PICKUP";
  } else {
    bidDeliveryChoice = "SHIP";
  }

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
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Account-age cap: a bid is a financial commitment up to `amount`, so cap on
  // the bid amount itself (not just the reserve).
  const ageCheck = checkAmountAllowed(user, amount);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  if (getAvailableBalance(user) < calculateReserveAmount(amount)) {
    return { error: "Onvoldoende saldo" };
  }

  // Create bid record (no balance deduction — only reserves)
  await prisma.auctionBid.create({
    data: { auctionId, bidderId: session.user.id, amount, deliveryChoice: bidDeliveryChoice },
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

  // Award Ember for placing a bid
  const { logActivity } = await import("@/actions/activity");
  logActivity(session.user.id, "PLACE_BID", { auctionId });

  return { success: true };
}

export async function buyNow(auctionId: string, deliveryChoice?: "SHIP" | "PICKUP") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (!auction.buyNowPrice) return { error: "Direct kopen is niet beschikbaar" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet je eigen veiling kopen" };

  // Delivery-keuze (Fase 27.95): voor BOTH moet koper kiezen, voor SHIP/PICKUP
  // wordt de auction-deliveryMethod gebruikt.
  let chosenDelivery: "SHIP" | "PICKUP";
  if (auction.deliveryMethod === "BOTH") {
    if (!deliveryChoice || (deliveryChoice !== "SHIP" && deliveryChoice !== "PICKUP")) {
      return { error: "Kies of je wilt verzenden of ophalen" };
    }
    chosenDelivery = deliveryChoice;
  } else if (auction.deliveryMethod === "PICKUP") {
    chosenDelivery = "PICKUP";
  } else {
    chosenDelivery = "SHIP";
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Voor SHIP-aankoop: address vereist. Voor PICKUP: niet relevant.
  if (chosenDelivery === "SHIP" && (!user.street || !user.postalCode || !user.city)) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

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

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: "BOUGHT_NOW",
        winnerId: session.user.id,
        finalPrice: auction.buyNowPrice,
        paymentStatus: "PAID",
      },
    });

    // ShippingBundle. Voor SHIP: address verplicht (gegarandeerd door check
    // hierboven). Voor PICKUP: address mag null, deliveryMethod=PICKUP zodat
    // de pickup-flow (PickupSchedule, code-confirm) bekend werkt.
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
        deliveryMethod: chosenDelivery,
        paymentMode: "PLATFORM",
        buyerStreet: chosenDelivery === "SHIP" ? user.street! : null,
        buyerHouseNumber: chosenDelivery === "SHIP" ? user.houseNumber : null,
        buyerPostalCode: chosenDelivery === "SHIP" ? user.postalCode! : null,
        buyerCity: chosenDelivery === "SHIP" ? user.city! : null,
        buyerCountry: chosenDelivery === "SHIP" ? user.country : null,
      },
    });

    // Notify seller about buy-now sale
    await createNotification(
      auction.sellerId,
      "ORDER_PAID",
      chosenDelivery === "PICKUP" ? "Veiling direct gekocht — ophalen" : "Veiling direct gekocht!",
      `"${auction.title}" is direct gekocht voor €${auction.buyNowPrice.toFixed(2)}. ${chosenDelivery === "PICKUP" ? "Stem de ophaal-afspraak af in chat." : "Bekijk je verkopen om te verzenden."}`,
      "/dashboard/verkopen"
    );

    // Fase 27.98: sync buyer's reservedBalance. Een eerdere bid op deze
    // auction (eerste bod, daarna buyNow) blijft als bid-record bestaan, maar
    // status is nu BOUGHT_NOW. Zonder sync zou recalculateTotalReserved bij
    // een latere balance-actie het correct opruimen, maar het is netter om
    // het hier expliciet te doen zodat de UI direct juiste cijfers toont.
    await syncReservedBalance(session.user.id);
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

    // Pre-create PENDING ShippingBundle (Fase 27.93). Consistent met
    // finalizeAuction zodat seller een 'wacht-op-betaling' sale ziet en de
    // koper de aankoop kan terugvinden via de Pending-Auctions sectie op
    // /dashboard/aankopen. completeAuctionPayment promoot deze rij naar PAID
    // i.p.v. een nieuwe aan te maken (auctionId @unique).
    // deliveryMethod: snapshot van koper-keuze (Fase 27.95).
    await createPendingBundle({
      buyerId: session.user.id,
      sellerId: auction.sellerId,
      totalItemCost: auction.buyNowPrice,
      shippingCost: 0,
      auctionId,
      deliveryMethod: chosenDelivery,
      address: chosenDelivery === "SHIP"
        ? {
            street: user.street,
            houseNumber: user.houseNumber,
            postalCode: user.postalCode,
            city: user.city,
            country: user.country,
          }
        : undefined,
    });

    await createNotification(
      session.user.id,
      "AUCTION_WIN",
      "Direct gekocht — betaling vereist",
      `Je hebt "${auction.title}" direct gekocht voor €${auction.buyNowPrice.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
      `/nl/dashboard/aankopen`
    );

    // Notify seller — pending sale, payment not in yet
    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Veiling direct gekocht — wachten op betaling",
      `"${auction.title}" is direct gekocht voor €${auction.buyNowPrice.toFixed(2)} maar de koper moet nog betalen. Verzend pas zodra de betaling binnen is (5 dagen deadline).`,
      `/nl/veilingen/${auctionId}`
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
    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Veiling geëindigd zonder bieders",
      `Je veiling "${auction.title}" is afgelopen zonder biedingen.`,
      `/nl/veilingen/${auctionId}`
    );
    return;
  }

  const highestBid = auction.bids[0];

  // Delivery-resolutie (Fase 27.95): bij BOTH gebruikt finalize de keuze van
  // de winning bidder. Bij SHIP/PICKUP is de auction-deliveryMethod leidend
  // (bid.deliveryChoice was bij placeBid al daarop ingesteld, dus consistent).
  const winnerDelivery: "SHIP" | "PICKUP" =
    auction.deliveryMethod === "PICKUP"
      ? "PICKUP"
      : auction.deliveryMethod === "SHIP"
        ? "SHIP"
        : (highestBid.deliveryChoice as "SHIP" | "PICKUP" | null) === "PICKUP"
          ? "PICKUP"
          : "SHIP"; // Fallback voor BOTH zonder bid-keuze

  if (auction.reservePrice && highestBid.amount < auction.reservePrice) {
    // Reserve not met — no payment needed (40% reserve model, no actual deduction was made)
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: "ENDED_RESERVE_NOT_MET" },
    });
    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Reserveprijs niet behaald",
      `Je veiling "${auction.title}" is afgelopen op €${highestBid.amount.toFixed(2)} maar heeft de reserveprijs niet gehaald.`,
      `/nl/veilingen/${auctionId}`
    );
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

    // Create ShippingBundle. Voor SHIP: address vereist; als winner geen
    // adres heeft slaan we de bundle-creatie over en moet de winner via
    // /dashboard/verzending zijn adres invullen vóór seller kan verzenden.
    // Voor PICKUP: address null is OK, deliveryMethod=PICKUP zodat de
    // pickup-flow (PickupSchedule + code-confirm) werkt.
    const canCreateBundle = winnerDelivery === "PICKUP" || (winner.street && winner.postalCode && winner.city);
    if (canCreateBundle) {
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
          deliveryMethod: winnerDelivery,
          paymentMode: "PLATFORM",
          buyerStreet: winnerDelivery === "SHIP" ? winner.street : null,
          buyerHouseNumber: winnerDelivery === "SHIP" ? winner.houseNumber : null,
          buyerPostalCode: winnerDelivery === "SHIP" ? winner.postalCode : null,
          buyerCity: winnerDelivery === "SHIP" ? winner.city : null,
          buyerCountry: winnerDelivery === "SHIP" ? winner.country : null,
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

    // Fase 27.98: post-flip sync. Status is nu ENDED_SOLD/PAID, dus winner-bid
    // telt niet meer als ACTIVE. Winner heeft volledig betaald → reserve = 0.
    // Sync zet reservedBalance correct, anders blijft de stale waarde van vóór
    // de status-flip hangen (loop on regel 510-512 was vóór de flip).
    await syncReservedBalance(highestBid.bidderId);

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

    // Fase 27.98: post-flip sync. Winner-bid is niet meer ACTIVE; in plaats
    // daarvan pakt recalculateTotalReserved nu de AWAITING_PAYMENT-tak op.
    // Effect: 40% van finalPrice blijft gereserveerd tot completeAuctionPayment.
    await syncReservedBalance(highestBid.bidderId);

    // Pre-create a PENDING ShippingBundle so the buyer sees a "wacht op
    // betaling" order and the seller sees a pending sale. Address fields
    // can stay null; completeAuctionPayment fills them at PAID transition.
    // Skip if the winner already has an active bundle on this auction
    // (could happen via runner-up rotation).
    const existingBundle = await prisma.shippingBundle.findUnique({ where: { auctionId } });
    if (!existingBundle) {
      await createPendingBundle({
        buyerId: highestBid.bidderId,
        sellerId: auction.sellerId,
        totalItemCost: totalCost,
        shippingCost: 0,
        auctionId,
        deliveryMethod: winnerDelivery,
        address: winner && winnerDelivery === "SHIP"
          ? {
              street: winner.street,
              houseNumber: winner.houseNumber,
              postalCode: winner.postalCode,
              city: winner.city,
              country: winner.country,
            }
          : undefined,
      });
    }

    // Notify winner they need to pay
    await createNotification(
      highestBid.bidderId,
      "OUTBID",
      "Veiling gewonnen — betaling vereist",
      `Je hebt "${auction.title}" gewonnen voor €${totalCost.toFixed(2)}. Betaal binnen 5 dagen.`,
      `/nl/veilingen/${auctionId}`
    );

    // Notify seller — this is NOT a confirmed sale yet, payment is pending.
    await createNotification(
      auction.sellerId,
      "ITEM_SOLD",
      "Veiling beëindigd — wachten op betaling",
      `"${auction.title}" is verkocht voor €${totalCost.toFixed(2)} maar de winnaar moet nog betalen. Verzend pas zodra de betaling binnen is (5 dagen deadline).`,
      `/nl/veilingen/${auctionId}`
    );
  }
}

// ============================================================
// AUTOBID
// ============================================================

export async function setAutoBid(auctionId: string, maxAmount: number, deliveryChoice?: "SHIP" | "PICKUP") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet bieden op je eigen veiling" };
  if (new Date() > auction.endTime) return { error: "Veiling is afgelopen" };

  // Delivery-keuze (Fase 27.95) — zelfde regels als placeBid.
  let abDeliveryChoice: string | null = null;
  if (auction.deliveryMethod === "BOTH") {
    if (!deliveryChoice || (deliveryChoice !== "SHIP" && deliveryChoice !== "PICKUP")) {
      return { error: "Kies of je wilt verzenden of ophalen voordat je een autobied instelt" };
    }
    abDeliveryChoice = deliveryChoice;
  } else if (auction.deliveryMethod === "PICKUP") {
    abDeliveryChoice = "PICKUP";
  } else {
    abDeliveryChoice = "SHIP";
  }

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
    create: { userId: session.user.id, auctionId, maxAmount, isActive: true, deliveryChoice: abDeliveryChoice },
    update: { maxAmount, isActive: true, deliveryChoice: abDeliveryChoice },
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

  // Fase 27.96: suspension-check ontbrak hier — een geschorste user kon
  // alsnog een veiling afbetalen. Inconsistent met placeBid/buyNow/setAutoBid
  // en zou suspension effectief omzeilen voor financiële commitments.
  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { shippingMethods: true },
  });

  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.winnerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (auction.paymentStatus !== "AWAITING_PAYMENT") return { error: "Geen openstaande betaling" };

  // Check deadline. Do NOT flip the auction to PAYMENT_FAILED here — leave that
  // to the cron, which decides between rotating to a runner-up and failing the
  // auction. Mutating here would short-circuit rotation.
  if (auction.paymentDeadline && new Date() > auction.paymentDeadline) {
    return { error: "De betalingsdeadline is verlopen" };
  }

  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  // Fase 27.98: sync vóór de availableBalance-check zodat we niet op stale
  // reservedBalance werken (kan ontstaan na status-flips of fout-historiek).
  // Het 40%-commitment voor deze AWAITING_PAYMENT auction zit IN reservedBalance,
  // dus we vergelijken totalCost tegen (balance - reserved + die 40%).
  const syncedReserved = await syncReservedBalance(session.user.id);
  const totalCost = auction.finalPrice ?? 0;
  const ownReserveOnThisAuction = calculateReserveAmount(totalCost);
  // Available exclusief de eigen reserve op deze auction (die wordt zo
  // sowieso 'omgezet' naar de echte deductie).
  const availableExcludingOwnReserve = buyer.balance - syncedReserved + ownReserveOnThisAuction;

  if (availableExcludingOwnReserve < totalCost) {
    return { error: `Onvoldoende saldo. Benodigd: €${totalCost.toFixed(2)}, beschikbaar: €${availableExcludingOwnReserve.toFixed(2)}` };
  }

  // Bestaande PENDING bundle bevat de delivery-keuze die bij finalize/buyNow
  // is vastgelegd. Voor SHIP eisen we adres; voor PICKUP niet.
  const existing = await prisma.shippingBundle.findUnique({ where: { auctionId } });
  const bundleDelivery = (existing?.deliveryMethod ?? "SHIP") as "SHIP" | "PICKUP";

  if (bundleDelivery === "SHIP" && (!buyer.street || !buyer.postalCode || !buyer.city)) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Deduct from buyer
  await deductBalance(session.user.id, totalCost, "AUCTION_WIN", `Veiling gewonnen: ${auction.title}`, auctionId);

  // Escrow for seller
  await escrowCredit(auction.sellerId, totalCost, `Veiling verkocht (escrow): ${auction.title}`);

  // Promote the PENDING bundle (created by finalizeAuction) to PAID, filling
  // in any address fields that were unknown at AWAITING_PAYMENT time. Voor
  // PICKUP-bundles vullen we geen adres in — koper haalt op.
  if (existing) {
    await prisma.shippingBundle.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        buyerStreet: bundleDelivery === "SHIP" ? buyer.street : null,
        buyerHouseNumber: bundleDelivery === "SHIP" ? buyer.houseNumber : null,
        buyerPostalCode: bundleDelivery === "SHIP" ? buyer.postalCode : null,
        buyerCity: bundleDelivery === "SHIP" ? buyer.city : null,
        buyerCountry: bundleDelivery === "SHIP" ? buyer.country : null,
      },
    });
  } else {
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
        deliveryMethod: bundleDelivery,
        paymentMode: "PLATFORM",
        buyerStreet: bundleDelivery === "SHIP" ? buyer.street : null,
        buyerHouseNumber: bundleDelivery === "SHIP" ? buyer.houseNumber : null,
        buyerPostalCode: bundleDelivery === "SHIP" ? buyer.postalCode : null,
        buyerCity: bundleDelivery === "SHIP" ? buyer.city : null,
        buyerCountry: bundleDelivery === "SHIP" ? buyer.country : null,
      },
    });
  }

  // Update auction payment status
  await prisma.auction.update({
    where: { id: auctionId },
    data: { paymentStatus: "PAID" },
  });

  // Fase 27.102: post-payment sync. Auction.paymentStatus is nu PAID dus
  // recalculateTotalReserved telt deze auction niet meer (filter op
  // AWAITING_PAYMENT). Zonder sync blijft de oude 40%-reserve in
  // User.reservedBalance hangen, terwijl het commitment is afgerond.
  // Symptoom: 27 buyer betaalde Buy-Now van €714.42, balance correct -€714.42,
  // maar reservedBalance bleef €285.77 staan in plaats van €0.
  await syncReservedBalance(session.user.id);

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

// Fase 27.88: veiling annuleren door eigenaar wanneer er nog geen biedingen
// zijn binnengekomen. Alleen mogelijk in ACTIVE-status zonder bids — zodra er
// een bod is, kan de seller niet meer annuleren (anders zou hij bieders kunnen
// frustreren door bewust hoog/laag te annuleren). Race-safe: updateMany met
// status- én bids-count-gate via een transactie.
export async function cancelAuction(auctionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { sellerId: true, status: true, title: true, _count: { select: { bids: true } } },
  });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (auction.status !== "ACTIVE") return { error: "Alleen actieve veilingen kunnen worden geannuleerd" };
  if (auction._count.bids > 0) return { error: "Er is al een bod uitgebracht — annuleren niet meer mogelijk" };

  // Race-safe flip: ACTIVE → CANCELLED. Als er tussen het lezen en schrijven
  // toch een bod binnenkomt, willen we het annuleren tegenhouden. Daarom een
  // transactie met re-check op bids-count.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({
      where: { id: auctionId },
      select: { _count: { select: { bids: true } } },
    });
    if (!fresh || fresh._count.bids > 0) {
      return { error: "Er is intussen een bod gedaan — annuleren niet meer mogelijk" } as const;
    }
    const flipped = await tx.auction.updateMany({
      where: { id: auctionId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    if (flipped.count === 0) {
      return { error: "Veiling kon niet geannuleerd worden — status is gewijzigd" } as const;
    }
    return { success: true } as const;
  });

  return result;
}
