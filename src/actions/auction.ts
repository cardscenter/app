"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuctionSchema } from "@/lib/validations/auction";
import { checkAuctionLimit } from "@/lib/account-limits";
import { getMinimumNextBid, ANTI_SNIPE_MINUTES, ANTI_SNIPE_EXTENSION_MINUTES } from "@/lib/auction/bid-increments";
import { deductBalance, deductBidPayment, escrowCredit } from "@/actions/wallet";
import { calculateBidFees } from "@/lib/auction/fees";
import { resolveAutoBids } from "@/lib/auction/autobid";
import { createNotification } from "@/actions/notification";
import { getAvailableBalance, calculateReserveAmount, syncReservedBalance } from "@/lib/balance-check";
import { applyFreeUpsellsToCost } from "@/lib/upsell-config";
import { generateOrderNumber } from "@/lib/order-number";
import { createPendingBundle } from "@/lib/shipping-bundle";
import { checkAmountAllowed } from "@/lib/account-age";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";
import { bidPassesVerifiedGate, IP_OVERLAP_LOOKBACK_DAYS } from "@/lib/auction/bid-tiers";
import { logAdminAction } from "@/lib/admin-audit";
import { publish, publishMany, userChannel, auctionChannel } from "@/lib/realtime";
import { headers } from "next/headers";
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
  let perEntryCosts: number[] = [];
  let freeUsed = 0;

  if (data.upsells) {
    try {
      upsellEntries = JSON.parse(data.upsells) as { type: UpsellType; days: number }[];
      const seller = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true, reservedBalance: true, accountType: true, freeUpsellsRemaining: true },
      });
      const accountType = seller?.accountType ?? "FREE";
      const allocation = applyFreeUpsellsToCost(
        upsellEntries,
        accountType,
        seller?.freeUpsellsRemaining ?? 0,
        "auction"
      );
      perEntryCosts = allocation.perEntry;
      totalUpsellCost = allocation.total;
      freeUsed = allocation.freeUsed;

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
  if (upsellEntries.length > 0) {
    for (let i = 0; i < upsellEntries.length; i++) {
      const entry = upsellEntries[i];
      const cost = perEntryCosts[i];
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

    // Race-safe quota-decrement (audit-fix Fase 31). Conditional updateMany
    // voorkomt dubbele claim als parallelle createAuction/createListing
    // dezelfde quota intussen heeft uitgenut. Anders dan in createListing
    // kunnen we hier niet rollbacken (auction + upsells zijn al gecreëerd
    // buiten een wrapping-transaction). Bij race: log warning, seller krijgt
    // dubbel gratis quota — minor finanical impact (€0,75/dag x N dagen).
    // Volledige fix vereist refactor van createAuction naar één $transaction.
    if (freeUsed > 0) {
      const updated = await prisma.user.updateMany({
        where: { id: session.user.id, freeUpsellsRemaining: { gte: freeUsed } },
        data: { freeUpsellsRemaining: { decrement: freeUsed } },
      });
      if (updated.count === 0) {
        console.warn(
          `[createAuction] Free-upsell quota race for user ${session.user.id}: claimed ${freeUsed} but quota was depleted. Seller received bonus quota.`
        );
      }
    }

    if (totalUpsellCost > 0) {
      await deductBalance(
        session.user.id,
        totalUpsellCost,
        "UPSELL",
        `Promotie-opties veiling: ${data.title}`,
        auction.id
      );
    }
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

  // Check available balance (15% reserve model — Fase 29)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Account-age cap: a bid is a financial commitment up to `amount`, so cap on
  // the bid amount itself (not just the reserve).
  const ageCheck = checkAmountAllowed(user, amount);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  // Fase 29: bids ≥ €2500 vereisen een geverifieerd account (tenzij admin
  // explicit business-vrijstelling heeft toegekend). Onder de drempel is
  // verificatie niet nodig.
  if (!bidPassesVerifiedGate(amount, user)) {
    return { error: "VERIFIED_REQUIRED_FOR_HIGH_BID" };
  }

  if (getAvailableBalance(user) < calculateReserveAmount(amount)) {
    return { error: "Onvoldoende saldo" };
  }

  // Fase 29: IP-snapshot voor anti-shill-bidding-detectie. Werk via headers()
  // (next/headers). Hard-block als bidder-IP overlapt met seller's recente
  // login-IP (binnen IP_OVERLAP_LOOKBACK_DAYS), anders soft-flag als ander
  // bidder-account op deze veiling al vanaf dezelfde IP heeft gebid.
  const reqHeaders = await headers();
  const bidderIp =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    null;

  if (bidderIp) {
    // Hard-block: zelfde netwerk als verkoper binnen 7d-window
    const seller = await prisma.user.findUnique({
      where: { id: auction.sellerId },
      select: { lastLoginIp: true, lastLoginIpAt: true },
    });
    if (
      seller?.lastLoginIp === bidderIp &&
      seller.lastLoginIpAt &&
      seller.lastLoginIpAt > new Date(Date.now() - IP_OVERLAP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    ) {
      return { error: "BID_IP_OVERLAPS_SELLER" };
    }

    // Soft-flag: ander bidder-account op deze veiling vanaf dezelfde IP
    const otherBid = await prisma.auctionBid.findFirst({
      where: {
        auctionId,
        bidderIp,
        bidderId: { not: session.user.id },
      },
      select: { bidderId: true },
    });
    if (otherBid) {
      await logAdminAction({
        adminId: "system",
        action: "BID_IP_OVERLAP",
        targetType: "AUCTION",
        targetId: auctionId,
        metadata: {
          bidderId: session.user.id,
          otherBidderId: otherBid.bidderId,
          ip: bidderIp,
        },
      });
    }
  }

  // Create bid record (no balance deduction — only reserves)
  const bid = await prisma.auctionBid.create({
    data: {
      auctionId,
      bidderId: session.user.id,
      amount,
      deliveryChoice: bidDeliveryChoice,
      bidderIp,
    },
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

    // Real-time outbid-event (Fase 30A) — toast + UserBalance refresh
    publish(userChannel(previousHighestBid.bidderId), {
      type: "outbid",
      payload: { auctionId, auctionTitle: auction.title, newAmount: amount },
    });
    publish(userChannel(previousHighestBid.bidderId), { type: "balance-changed", payload: {} });
  }

  // Real-time bid-placed broadcast naar iedereen die op deze auction-page kijkt
  // (bidId placeholder — `bid` is de net-aangemaakte AuctionBid).
  publish(auctionChannel(auctionId), {
    type: "bid-placed",
    payload: {
      auctionId,
      bidId: bid.id,
      amount,
      bidderName: "anoniem",
      currentBid: amount,
      bidCount: 0,
    },
  });

  // Refresh balance van de nieuwe bidder zelf — reservering ging omhoog.
  publish(userChannel(session.user.id), { type: "balance-changed", payload: {} });

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

  // Account-age cap geldt ook voor buyNow — financieel commitment van buyNowPrice
  const ageCheck = checkAmountAllowed(user, auction.buyNowPrice);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  // Fase 29: buyNowPrice ≥ €2500 vereist een geverifieerd account, ook bij
  // direct-koop. Anders kan iemand de verified-eis omzeilen door buyNow te
  // gebruiken in plaats van een gewoon bod. Geldt voor zowel full-payment als
  // partial-payment pad — partial heeft 5d deadline en dus wanbetalingsrisico,
  // full-payment is direct geld weg dus minder risico, maar consistent gate.
  if (!bidPassesVerifiedGate(auction.buyNowPrice, user)) {
    return { error: "VERIFIED_REQUIRED_FOR_HIGH_BID" };
  }

  // Need at least 15% (Fase 29) — minimum to enter partial-payment flow
  if (available < reserveNeeded) {
    return { error: `Onvoldoende saldo. Je hebt minimaal €${reserveNeeded.toFixed(2)} (15%) nodig.` };
  }

  // Release reserves for ALL other bidders on this auction
  const allBidderIds = await prisma.auctionBid.findMany({
    where: { auctionId },
    select: { bidderId: true },
    distinct: ["bidderId"],
  });

  // Fase 31: buyer's premium ook op Buy Now (alle paden — bid, BuyNow met
  // bids, BuyNow zonder bids). Rate-bron: AUCTION_BUYER_PREMIUM_RATE.
  const buyNowFees = calculateBidFees(auction.buyNowPrice);

  if (available >= buyNowFees.total) {
    // Full payment — immediate purchase. Premium gaat naar platform via
    // deductBidPayment, escrow voor seller blijft het bid-deel.
    await deductBidPayment(
      session.user.id,
      buyNowFees.bid,
      buyNowFees.premium,
      `Direct gekocht: ${auction.title}`,
      auctionId,
    );
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
    // Partial payment — reserve 10% (Fase 30), give 5-day deadline. Bij niet-
    // betalen na 5d activeert auction-payment-deadline cron forfait + strike
    // voor amounts ≥ €2000 (Fase 31).
    const paymentDeadline = new Date();
    paymentDeadline.setDate(paymentDeadline.getDate() + 5);

    // Atomic: auction-flip + bid-record + pending-bundle in één $transaction
    // (audit-fix Fase 31). Voorheen waren dit 3 sequentiële prisma-calls;
    // bij failure tussen stap 1 en 3 ontstond een orphaned auction in
    // AWAITING_PAYMENT zonder bid-record waardoor de cron-rotatie geen
    // runner-up vond. syncReservedBalance blijft buiten de transactie omdat
    // het een afgeleide herberekening is (idempotent — kan later herhaald).
    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: "BOUGHT_NOW",
          winnerId: session.user.id,
          finalPrice: auction.buyNowPrice,
          paymentStatus: "AWAITING_PAYMENT",
          paymentDeadline,
        },
      });

      await tx.auctionBid.create({
        data: { auctionId, bidderId: session.user.id, amount: auction.buyNowPrice },
      });

      // Pre-create PENDING ShippingBundle (Fase 27.93). Inline omdat
      // createPendingBundle een eigen prisma.shippingBundle.create doet
      // buiten onze tx — we herhalen die logica hier zodat het atomic blijft.
      await tx.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: session.user.id,
          sellerId: auction.sellerId,
          shippingCost: 0,
          totalItemCost: auction.buyNowPrice,
          totalCost: auction.buyNowPrice,
          status: "PENDING",
          auctionId,
          deliveryMethod: chosenDelivery,
          buyerStreet: chosenDelivery === "SHIP" ? user.street ?? null : null,
          buyerHouseNumber: chosenDelivery === "SHIP" ? user.houseNumber ?? null : null,
          buyerPostalCode: chosenDelivery === "SHIP" ? user.postalCode ?? null : null,
          buyerCity: chosenDelivery === "SHIP" ? user.city ?? null : null,
          buyerCountry: chosenDelivery === "SHIP" ? user.country ?? null : null,
        },
      });
    });

    // Idempotente reserve-recalculatie buiten de tx — leest bid-records
    // die binnen de tx zijn aangemaakt. Bij hier-falen blijft de DB consistent;
    // syncReservedBalance kan opnieuw vanuit een andere actie of via cron.
    await syncReservedBalance(session.user.id);

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
      // Real-time balance-changed (Fase 30A) — andere bidders zien hun
      // reserve terug nadat een buyNow de auction afsluit.
      publish(userChannel(bidderId), { type: "balance-changed", payload: {} });
    }
  }

  // Real-time balance + auction-won voor de buyer + balance voor seller (escrow).
  publish(userChannel(session.user.id), { type: "balance-changed", payload: {} });
  publish(userChannel(auction.sellerId), { type: "balance-changed", payload: {} });
  publish(userChannel(session.user.id), {
    type: "auction-won",
    payload: {
      auctionId,
      auctionTitle: auction.title,
      finalPrice: auction.buyNowPrice,
      paymentDeadline: available >= auction.buyNowPrice ? null : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
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
    publish(auctionChannel(auctionId), {
      type: "auction-ended",
      payload: { auctionId, status: "ENDED_NO_BIDS", finalPrice: null },
    });
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
    // Reserve not met — no payment needed (15% reserve model, no actual deduction was made)
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
    publish(auctionChannel(auctionId), {
      type: "auction-ended",
      payload: { auctionId, status: "ENDED_RESERVE_NOT_MET", finalPrice: highestBid.amount },
    });
    return;
  }

  // Auction sold — try to collect full payment from winner
  const winner = await prisma.user.findUnique({ where: { id: highestBid.bidderId } });
  const totalCost = highestBid.amount;

  // Fase 31: koper betaalt bid + buyer's premium. Premium gaat naar
  // platform via deductBidPayment, escrow voor seller blijft het bid-deel.
  const bidFees = calculateBidFees(totalCost);

  // Fase 29: check of winner kan betalen ZONDER andere reserves te raken.
  // Voorheen werd `winner.balance >= totalCost` gebruikt, wat een dubbel-besteden
  // vector opent. Correcte check: balance - andere-reserves ≥ bid+premium.
  // De eigen 10%-reserve op deze auction wordt 'omgezet' naar de werkelijke
  // betaling, andere reserves blijven intact.
  const ownReserveOnThisAuction = winner ? calculateReserveAmount(totalCost) : 0;
  const winnerEffectiveAvailable = winner
    ? winner.balance - winner.reservedBalance + ownReserveOnThisAuction
    : 0;

  if (winner && winnerEffectiveAvailable >= bidFees.total) {
    // Winner has enough balance — deduct bid+premium and escrow bid to seller
    await deductBidPayment(
      highestBid.bidderId,
      bidFees.bid,
      bidFees.premium,
      `Veiling gewonnen: ${auction.title}`,
      auctionId,
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

    // Real-time auction-won + balance-changed (Fase 30A) + auction-ended broadcast (Fase 30B)
    publish(userChannel(highestBid.bidderId), {
      type: "auction-won",
      payload: { auctionId, auctionTitle: auction.title, finalPrice: totalCost, paymentDeadline: null },
    });
    publishMany(
      [userChannel(highestBid.bidderId), userChannel(auction.sellerId)],
      { type: "balance-changed", payload: {} },
    );
    publish(auctionChannel(auctionId), {
      type: "auction-ended",
      payload: { auctionId, status: "ENDED_SOLD", finalPrice: totalCost },
    });
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
    // Effect: 15% van finalPrice blijft gereserveerd tot completeAuctionPayment
    // (Fase 29 — was 40%).
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

    // Real-time auction-won (AWAITING_PAYMENT-pad) + balance-changed (Fase 30A)
    publish(userChannel(highestBid.bidderId), {
      type: "auction-won",
      payload: {
        auctionId,
        auctionTitle: auction.title,
        finalPrice: totalCost,
        paymentDeadline: paymentDeadline.toISOString(),
      },
    });
    publish(userChannel(highestBid.bidderId), { type: "balance-changed", payload: {} });
    // Auction-ended broadcast — alle viewers zien de status-flip (Fase 30B)
    publish(auctionChannel(auctionId), {
      type: "auction-ended",
      payload: { auctionId, status: "ENDED_SOLD", finalPrice: totalCost },
    });
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

  // Check available balance (15% of max autobid amount — Fase 29)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Fase 29: autobid maxAmount ≥ €2500 vereist verified-account (tenzij
  // business-vrijstelling). Zelfde regel als placeBid — anders kan iemand
  // via autobid de drempel omzeilen.
  if (!bidPassesVerifiedGate(maxAmount, user)) {
    return { error: "VERIFIED_REQUIRED_FOR_HIGH_BID" };
  }

  if (getAvailableBalance(user) < calculateReserveAmount(maxAmount)) {
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

  // Fase 27.98 + 29 + 31: sync vóór de availableBalance-check. Het 10%-commitment
  // voor deze AWAITING_PAYMENT auction zit IN reservedBalance. Koper betaalt
  // bid + buyer's premium (Fase 31).
  const syncedReserved = await syncReservedBalance(session.user.id);
  const totalCost = auction.finalPrice ?? 0;
  const fees = calculateBidFees(totalCost);
  const ownReserveOnThisAuction = calculateReserveAmount(totalCost);
  const availableExcludingOwnReserve = buyer.balance - syncedReserved + ownReserveOnThisAuction;

  if (availableExcludingOwnReserve < fees.total) {
    return { error: `Onvoldoende saldo. Benodigd: €${fees.total.toFixed(2)} (incl. €${fees.premium.toFixed(2)} veilingkosten), beschikbaar: €${availableExcludingOwnReserve.toFixed(2)}` };
  }

  // Bestaande PENDING bundle bevat de delivery-keuze die bij finalize/buyNow
  // is vastgelegd. Voor SHIP eisen we adres; voor PICKUP niet.
  const existing = await prisma.shippingBundle.findUnique({ where: { auctionId } });
  const bundleDelivery = (existing?.deliveryMethod ?? "SHIP") as "SHIP" | "PICKUP";

  if (bundleDelivery === "SHIP" && (!buyer.street || !buyer.postalCode || !buyer.city)) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Deduct bid+premium from buyer (Fase 31). Premium gaat naar platform via
  // de AUCTION_PREMIUM-Transaction in deductBidPayment.
  await deductBidPayment(session.user.id, fees.bid, fees.premium, `Veiling gewonnen: ${auction.title}`, auctionId);

  // Escrow for seller (alleen het bid-deel — premium is platform-revenue)
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
  // AWAITING_PAYMENT). Zonder sync blijft de oude reserve (15% sinds Fase 29,
  // was 40%) in User.reservedBalance hangen, terwijl het commitment is afgerond.
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

  // Real-time balance-changed (Fase 30A) — buyer betaalde, seller kreeg escrow.
  publishMany(
    [userChannel(session.user.id), userChannel(auction.sellerId)],
    { type: "balance-changed", payload: {} },
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
