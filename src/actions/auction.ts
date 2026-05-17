"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuctionSchema, updateAuctionSchema } from "@/lib/validations/auction";
import { computeEditScope, type EditScope } from "@/lib/auction/edit-scope";
import { checkAuctionLimit } from "@/lib/account-limits";
import { getMinimumNextBid, ANTI_SNIPE_MINUTES, ANTI_SNIPE_EXTENSION_MINUTES } from "@/lib/auction/bid-increments";
import { creditBalance, deductBalance, deductBidPayment, escrowCredit } from "@/actions/wallet";
import { calculateBidFees } from "@/lib/auction/fees";
import { resolveAutoBids } from "@/lib/auction/autobid";
import { createNotification } from "@/actions/notification";
import { getAvailableBalance, calculateReserveAmount, syncReservedBalance } from "@/lib/balance-check";
import { applyFreeUpsellsToCost } from "@/lib/upsell-config";
import {
  availableLabelsFor,
  calculateLabelCost,
  isValidLabelColor,
  isValidLabelType,
  MAX_LABELS_PER_AUCTION,
  type LabelColor,
  type LabelType,
} from "@/lib/auction/labels";
import { generateOrderNumber } from "@/lib/order-number";
import { createPendingBundle } from "@/lib/shipping-bundle";
import { enrichMethod, deriveListingShippingMethodIds } from "@/lib/shipping/static-methods";
import { mailboxEligibleType } from "@/lib/listing-types";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";
import { bidPassesVerifiedGate, IP_OVERLAP_LOOKBACK_DAYS } from "@/lib/auction/bid-tiers";
import { logAdminAction } from "@/lib/admin-audit";
import { publish, publishMany, userChannel, auctionChannel } from "@/lib/realtime";
import { hasValidShippingAddress } from "@/lib/address-validation";
import { processRunnerUpDecision } from "@/lib/cron-jobs";
import { deriveDurationDays, SCHEDULED_THRESHOLD_MS } from "@/lib/auction/timing";
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
    productType: formData.get("productType") || undefined,
    itemCategory: formData.get("itemCategory") || undefined,
    startingBid: formData.get("startingBid"),
    reservePrice: formData.get("reservePrice") || undefined,
    buyNowPrice: formData.get("buyNowPrice") || undefined,
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    runnerUpEnabled: formData.get("runnerUpEnabled") || undefined,
    deliveryMethod: formData.get("deliveryMethod") || "SHIP",
    upsells: formData.get("upsells") || undefined,
    allowMailbox: formData.get("allowMailbox") === "true",
  };

  // Labels gaan buiten het zod-schema om (niet alle bestaande callers sturen
  // dit veld); we parsen + valideren ze los hieronder.
  const labelsRaw = formData.get("labels");

  const result = createAuctionSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;

  // startTime + endTime komen direct uit het form. Bij `startTime > now + 5min`
  // wordt status SCHEDULED — anders ACTIVE (instant publish).
  const startTime = data.startTime;
  const endTime = data.endTime;
  const durationDays = deriveDurationDays(startTime, endTime);
  const initialStatus =
    startTime.getTime() > Date.now() + SCHEDULED_THRESHOLD_MS ? "SCHEDULED" : "ACTIVE";

  // Parse upsells (dual-handle window: startDay/endDay binnen veiling-duur).
  // Legacy `days`-format wordt nog ondersteund als fallback (volledig venster
  // vanaf dag 0). Nieuwe UI stuurt altijd startDay/endDay.
  type UpsellWindow = {
    type: UpsellType;
    startDay: number;
    endDay: number;
    days: number;
  };
  let upsellWindows: UpsellWindow[] = [];
  let totalUpsellCost = 0;
  let perEntryCosts: number[] = [];
  let freeUsed = 0;

  if (data.upsells) {
    try {
      const parsed = JSON.parse(data.upsells) as Array<{
        type: UpsellType;
        startDay?: number;
        endDay?: number;
        days?: number;
      }>;
      // Normaliseer naar 1-indexed inclusive window. Clamp tegen veiling-duur:
      // startDay ∈ [1, duration], endDay ∈ [startDay, duration].
      // days = endDay - startDay + 1 (inclusive).
      upsellWindows = parsed
        .map((e) => {
          let startDay: number;
          let endDay: number;
          if (typeof e.startDay === "number" && typeof e.endDay === "number") {
            startDay = Math.max(1, Math.min(durationDays, Math.floor(e.startDay)));
            endDay = Math.max(startDay, Math.min(durationDays, Math.floor(e.endDay)));
          } else {
            // Legacy: full window van dag 1 t/m laatste dag.
            startDay = 1;
            endDay = Math.min(
              durationDays,
              Math.max(1, e.days ?? durationDays),
            );
          }
          const days = Math.max(0, endDay - startDay + 1);
          return { type: e.type, startDay, endDay, days };
        })
        .filter((e) => e.days > 0);

      const seller = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          balance: true,
          reservedBalance: true,
          accountType: true,
          freeUpsellsRemaining: true,
        },
      });
      const accountType = seller?.accountType ?? "FREE";
      const allocation = applyFreeUpsellsToCost(
        upsellWindows.map((w) => ({ type: w.type, days: w.days })),
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
      upsellWindows = [];
    }
  }

  // Parse + valideer labels (max 2 per veiling, conditional availability,
  // bundle-prijs 1=€0,99 / 2=€1,69). Server-hercheck van availability is
  // anti-tamper (UI kan claim "Geen Reserve" terwijl reservePrice gezet is).
  let parsedLabels: { type: LabelType; colorKey: LabelColor }[] = [];
  let labelsCost = 0;
  if (typeof labelsRaw === "string" && labelsRaw.length > 0) {
    try {
      const raw = JSON.parse(labelsRaw) as Array<{ type: string; colorKey: string }>;
      const cleaned = raw
        .filter(
          (l) =>
            typeof l?.type === "string" &&
            typeof l?.colorKey === "string" &&
            isValidLabelType(l.type) &&
            isValidLabelColor(l.colorKey),
        )
        .slice(0, MAX_LABELS_PER_AUCTION) as {
        type: LabelType;
        colorKey: LabelColor;
      }[];

      // Anti-tamper: hercheck availability tegen de feitelijke form-state.
      const availability = availableLabelsFor({
        reservePrice: data.reservePrice ?? null,
        buyNowPrice: data.buyNowPrice ?? null,
        condition: data.condition ?? null,
        auctionType: data.auctionType ?? null,
      });
      const availSet = new Set(
        availability.filter((a) => a.available).map((a) => a.type),
      );
      for (const l of cleaned) {
        if (!availSet.has(l.type)) {
          return { error: `Label "${l.type}" is niet beschikbaar voor deze veiling` };
        }
      }

      // Geen duplicates op type — als seller per ongeluk twee dezelfde stuurt,
      // pakken we de eerste.
      const seen = new Set<LabelType>();
      parsedLabels = cleaned.filter((l) => {
        if (seen.has(l.type)) return false;
        seen.add(l.type);
        return true;
      });

      labelsCost = calculateLabelCost(parsedLabels.length);

      if (labelsCost > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true, reservedBalance: true },
        });
        const availableBalance =
          (seller?.balance ?? 0) - (seller?.reservedBalance ?? 0);
        if (totalUpsellCost + labelsCost > availableBalance) {
          return { error: "Onvoldoende saldo voor promotie-opties" };
        }
      }
    } catch {
      parsedLabels = [];
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

  // Defense-in-depth: als de gebruiker `maxRunnerUpAttempts = 0` heeft, mag
  // `runnerUpEnabled` nooit `true` zijn op de DB-record. UI verbergt de toggle
  // al, maar bij directe form-submit / API-call zou de waarde misleidend zijn.
  // Effectief: cron `processRunnerUpDecision` finalize't toch direct, maar
  // we willen consistente data.
  const sellerSettings = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { maxRunnerUpAttempts: true },
  });
  const effectiveRunnerUpEnabled =
    (sellerSettings?.maxRunnerUpAttempts ?? 2) > 0 && data.runnerUpEnabled;

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
      productType: data.productType || null,
      itemCategory: data.itemCategory || null,
      sellerId: session.user.id,
      startingBid: data.startingBid,
      reservePrice: data.reservePrice || null,
      buyNowPrice: data.buyNowPrice || null,
      duration: durationDays,
      runnerUpEnabled: effectiveRunnerUpEnabled,
      deliveryMethod: data.deliveryMethod,
      pickupCity,
      startTime,
      endTime,
      status: initialStatus,
    },
  });

  // Create shipping method links (Fase 33 v2: server-side derivation).
  // STANDARD+SIGNED altijd inbegrepen, MAILBOX_PARCEL alleen voor SINGLE/MULTI
  // auctions onder €150 als seller `allowMailbox=true` heeft toegelicht.
  const isShipDelivery = data.deliveryMethod === "SHIP" || data.deliveryMethod === "BOTH";
  if (isShipDelivery) {
    const sellerData = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { country: true },
    });
    if (!sellerData?.country) {
      await prisma.auction.delete({ where: { id: auction.id } });
      return { error: "Vul eerst je land in op je profiel." };
    }

    // Voor mailbox-eligibility kijken we naar het hoogste bekende prijspunt
    // (buyNow > startBid). Bij ≥€150 wordt MAILBOX uitgesloten.
    const priceForCheck = data.buyNowPrice ?? data.startingBid ?? null;

    const derivedIds = await deriveListingShippingMethodIds({
      prisma,
      sellerId: session.user.id,
      allowMailbox: data.allowMailbox,
      listingType: data.auctionType,
      price: priceForCheck,
      mailboxEligible: mailboxEligibleType,
    });

    if (derivedIds.length === 0) {
      await prisma.auction.delete({ where: { id: auction.id } });
      return {
        error: "Configureer eerst je verzending via Dashboard → Verzending — er zijn geen actieve verzendmethoden.",
      };
    }

    const methods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: derivedIds }, sellerId: session.user.id, isActive: true },
    });

    for (const method of methods) {
      const enriched = enrichMethod(method, sellerData.country!);
      if (!enriched) continue;
      await prisma.auctionShippingMethod.create({
        data: { auctionId: auction.id, shippingMethodId: method.id, price: enriched.effectivePrice },
      });
    }
  }

  // Create upsell-records met dual-handle-window. 1-indexed inclusive:
  // dag N start op startTime + (N-1)*24u en duurt 24u. Voor SCHEDULED auctions
  // begint de promo-zichtbaarheid pas wanneer de veiling start.
  if (upsellWindows.length > 0) {
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 0; i < upsellWindows.length; i++) {
      const w = upsellWindows[i];
      const cost = perEntryCosts[i];
      const startsAt = new Date(startTime.getTime() + (w.startDay - 1) * dayMs);
      const expiresAt = new Date(startTime.getTime() + w.endDay * dayMs);

      await prisma.auctionUpsell.create({
        data: {
          auctionId: auction.id,
          type: w.type,
          startsAt,
          expiresAt,
          dailyCost: w.days > 0 ? cost / w.days : 0,
          totalCost: cost,
        },
      });
    }

    // Race-safe quota-decrement (audit-fix Fase 31). Conditional updateMany
    // voorkomt dubbele claim als parallelle createAuction/createListing
    // dezelfde quota intussen heeft uitgenut.
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
  }

  // Create label-records (max 2, bundle-cost al berekend).
  if (parsedLabels.length > 0) {
    const perLabelCost = labelsCost / parsedLabels.length;
    await prisma.auctionLabel.createMany({
      data: parsedLabels.map((l) => ({
        auctionId: auction.id,
        type: l.type,
        colorKey: l.colorKey,
        cost: Math.round(perLabelCost * 100) / 100,
      })),
    });
  }

  // Eén balance-deduct voor upsells + labels samen (was twee aparte voor labels
  // alleen — minder Transaction-rijen, simpeler trail).
  const totalPromotionCost = totalUpsellCost + labelsCost;
  if (totalPromotionCost > 0) {
    await deductBalance(
      session.user.id,
      totalPromotionCost,
      "UPSELL",
      `Promotie-opties veiling: ${data.title}`,
      auction.id
    );
  }

  // Award Ember for creating a listing (auctions count too)
  const { logActivity: logAuctionActivity } = await import("@/actions/activity");
  logAuctionActivity(session.user.id, "CREATE_LISTING", { auctionId: auction.id });

  // Bump auction-end scheduler — als deze nieuwe auction eerder eindigt dan
  // de huidige scheduled timer, herrekent de scheduler en zet 'ie korter.
  // Dynamic import om circulaire dep met finalizeAuction (in dit bestand)
  // te vermijden. Fire-and-forget — failure breekt auction-create niet.
  import("@/lib/auction-scheduler")
    .then(({ scheduleNextAuctionFinalize }) => scheduleNextAuctionFinalize("create-auction"))
    .catch((err) => console.error("[createAuction] scheduler bump failed", err));

  // Voor SCHEDULED auctions ook de activator-scheduler bumpen zodat 'ie
  // op startTime sub-seconde-nauwkeurig flipt naar ACTIVE.
  if (initialStatus === "SCHEDULED") {
    import("@/lib/auction-activator-scheduler")
      .then(({ scheduleNextAuctionActivation }) => scheduleNextAuctionActivation("create-auction"))
      .catch((err) => console.error("[createAuction] activator bump failed", err));
  }

  return { success: true, auctionId: auction.id };
}

export async function placeBid(auctionId: string, amount: number, deliveryChoice?: "SHIP" | "PICKUP") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.status === "SCHEDULED" || (auction.startTime && new Date() < auction.startTime)) {
    return { error: "Deze veiling is nog niet gestart" };
  }
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

  // Fase 29: bids ≥ €2500 vereisen een geverifieerd account (tenzij admin
  // explicit business-vrijstelling heeft toegekend). Onder de drempel is
  // verificatie niet nodig.
  if (!bidPassesVerifiedGate(amount, user)) {
    return { error: "VERIFIED_REQUIRED_FOR_HIGH_BID" };
  }

  if (getAvailableBalance(user) < calculateReserveAmount(amount)) {
    return { error: "Onvoldoende saldo" };
  }

  // Adres-validatie voor SHIP-veilingen: bidder moet adres hebben vóór bod.
  // Voor BOTH-veilingen: alleen verplicht als de bidder voor SHIP koos.
  if (bidDeliveryChoice === "SHIP") {
    const hasAddress = await hasValidShippingAddress(session.user.id);
    if (!hasAddress) return { error: "NO_ADDRESS" };
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
  if (auction.status === "SCHEDULED" || (auction.startTime && new Date() < auction.startTime)) {
    return { error: "Deze veiling is nog niet gestart" };
  }
  if (auction.status !== "ACTIVE") return { error: "Veiling is niet meer actief" };
  if (!auction.buyNowPrice) return { error: "Direct kopen is niet beschikbaar" };
  if (auction.sellerId === session.user.id) return { error: "Je kunt niet je eigen veiling kopen" };

  // Pak de prijs als lokale const zodat de narrowing door async closures
  // (prisma.$transaction(async (tx) => ...)) heen blijft staan.
  const buyNowPrice = auction.buyNowPrice;

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
          finalPrice: buyNowPrice,
          paymentStatus: "AWAITING_PAYMENT",
          paymentDeadline,
        },
      });

      await tx.auctionBid.create({
        data: { auctionId, bidderId: session.user.id, amount: buyNowPrice },
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
          totalItemCost: buyNowPrice,
          totalCost: buyNowPrice,
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
  if (auction.status === "SCHEDULED" || (auction.startTime && new Date() < auction.startTime)) {
    return { error: "Deze veiling is nog niet gestart" };
  }
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

  // Adres-validatie voor SHIP-autobids — zelfde regel als placeBid.
  if (abDeliveryChoice === "SHIP") {
    const hasAddress = await hasValidShippingAddress(session.user.id);
    if (!hasAddress) return { error: "NO_ADDRESS" };
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
    // Place a minimum bid to start the autobid process — placeBid sync't reserve
    const bidResult = await placeBid(auctionId, minimumBid);
    if (bidResult?.error) return bidResult;
  } else {
    // User is al hoogste bieder — geen nieuwe bid nodig, MAAR de reserve moet
    // wel herrekend worden omdat het maxAmount nu mogelijk hoger ligt dan z'n
    // huidige bid (reserve gaat over max(userBid, autoMax)). syncReservedBalance
    // publisht zelf 'balance-changed' naar de user-channel.
    await syncReservedBalance(session.user.id);
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

  // Audit-fix: race-safe pre-emptive claim. Flippen we de status NU naar PAID
  // (atomic updateMany met paymentStatus-filter), dan kan de cron
  // `auction-payment-deadline` deze auction niet meer oppakken voor strike +
  // rotation. Cron's filter is "paymentStatus: AWAITING_PAYMENT" — zodra wij
  // die naar PAID flippen, of cron 'm naar AWAITING_RUNNER_UP_DECISION,
  // verliest de andere de race en skipt.
  //
  // Bij count=0 heeft cron 'm al gepakt → buyer mag niet meer betalen, want
  // strike+fee is al toegepast en runner-up-flow is gestart. Voor échte
  // crashes tussen deze flip en de side-effects (deductBidPayment / escrow /
  // bundle-update): paymentStatus blijft PAID terwijl side-effects half zijn
  // — admin-detectie nodig. In praktijk zelden, en geld is niet weg
  // (deductBidPayment runt als eerste atomair).
  const claim = await prisma.auction.updateMany({
    where: { id: auctionId, paymentStatus: "AWAITING_PAYMENT" },
    data: { paymentStatus: "PAID" },
  });
  if (claim.count === 0) {
    return { error: "De betaaltermijn is verlopen — de runner-up-flow is gestart" };
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

  // (status flip naar PAID is bovenaan al atomic gedaan — geen tweede update)

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
  if (auction.status !== "ACTIVE" && auction.status !== "SCHEDULED") {
    return { error: "Alleen actieve of geplande veilingen kunnen worden geannuleerd" };
  }
  if (auction._count.bids > 0) return { error: "Er is al een bod uitgebracht — annuleren niet meer mogelijk" };

  // Race-safe flip: ACTIVE/SCHEDULED → CANCELLED. Als er tussen het lezen en
  // schrijven toch een bod binnenkomt, willen we het annuleren tegenhouden.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({
      where: { id: auctionId },
      select: { _count: { select: { bids: true } } },
    });
    if (!fresh || fresh._count.bids > 0) {
      return { error: "Er is intussen een bod gedaan — annuleren niet meer mogelijk" } as const;
    }
    const flipped = await tx.auction.updateMany({
      where: { id: auctionId, status: { in: ["ACTIVE", "SCHEDULED"] } },
      data: { status: "CANCELLED" },
    });
    if (flipped.count === 0) {
      return { error: "Veiling kon niet geannuleerd worden — status is gewijzigd" } as const;
    }
    return { success: true } as const;
  });

  if ("error" in result) return result;

  // Refund promotie-kosten naar seller balance. Spotlights pro-rata op basis
  // van ongebruikte tijd, labels 100% terug. Free-quota wordt NIET teruggezet
  // (anti-recycle van de gratis-slot via spam-create-and-cancel). Failure hier
  // breekt de cancel niet — alleen loggen, status is al CANCELLED.
  let refundedAmount = 0;
  try {
    refundedAmount = await refundAuctionPromotion(session.user.id, auctionId, auction.title);
  } catch (err) {
    console.error(`[cancelAuction] Promotion refund failed for auction ${auctionId}:`, err);
  }

  return { success: true, refundedAmount } as const;
}

// Pro-rata spotlight-refund + 100% label-refund bij auction-cancel.
// Apart genoemd zodat we 'm hergebruiken als andere paden ook upsells moeten
// teruggeven (bv. admin-cancel via moderation in de toekomst).
async function refundAuctionPromotion(
  sellerId: string,
  auctionId: string,
  auctionTitle: string,
): Promise<number> {
  const now = new Date();

  // Upsells: pro-rata op basis van ongebruikte tijd. expiresAt voortzetten
  // naar now zodat ze niet meer renderen op cards. Skip records die al
  // verlopen waren of waar totalCost === 0 (gratis quota).
  const upsells = await prisma.auctionUpsell.findMany({
    where: { auctionId },
  });

  let totalRefund = 0;
  const upsellRefundsForLog: { type: string; amount: number }[] = [];

  for (const upsell of upsells) {
    if (upsell.totalCost <= 0) continue; // gratis (quota) — niets te refunden
    const startsAt = upsell.startsAt;
    const expiresAt = upsell.expiresAt;
    let refundAmount = 0;
    if (now <= startsAt) {
      // Window is nog niet begonnen → 100% terug
      refundAmount = upsell.totalCost;
    } else if (now >= expiresAt) {
      refundAmount = 0; // al verlopen
    } else {
      const totalMs = expiresAt.getTime() - startsAt.getTime();
      const remainingMs = expiresAt.getTime() - now.getTime();
      const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
      refundAmount = Math.round(upsell.totalCost * ratio * 100) / 100;
    }
    if (refundAmount > 0) {
      totalRefund += refundAmount;
      upsellRefundsForLog.push({ type: upsell.type, amount: refundAmount });
    }
    // Stop verdere zichtbaarheid op de cards: zet expiresAt = now als die nog
    // in de toekomst lag. Dit voorkomt dat een gecancelde veiling in de
    // sponsored-row blijft staan tot z'n natuurlijke expiresAt.
    if (expiresAt > now) {
      await prisma.auctionUpsell.update({
        where: { id: upsell.id },
        data: { expiresAt: now },
      });
    }
  }

  // Labels: 100% van cost terug. Snapshot per-label cost staat al op de rij.
  const labels = await prisma.auctionLabel.findMany({
    where: { auctionId },
  });
  const labelRefundTotal = labels.reduce((sum, l) => sum + (l.cost ?? 0), 0);
  totalRefund += labelRefundTotal;

  const totalRounded = Math.round(totalRefund * 100) / 100;
  if (totalRounded <= 0) return 0;

  const parts: string[] = [];
  if (upsellRefundsForLog.length > 0) {
    parts.push(
      upsellRefundsForLog
        .map((u) => `${u.type} €${u.amount.toFixed(2)}`)
        .join(", "),
    );
  }
  if (labelRefundTotal > 0) {
    parts.push(`Labels €${labelRefundTotal.toFixed(2)}`);
  }
  const description = `Refund promotie-kosten geannuleerde veiling "${auctionTitle}"${
    parts.length > 0 ? ` (${parts.join(" + ")})` : ""
  }`;

  await creditBalance(
    sellerId,
    totalRounded,
    "UPSELL_REFUND",
    description,
    auctionId,
  );
  return totalRounded;
}

// ============================================================
// RUNNER-UP OFFER FLOW (post-Fase-33)
// ============================================================
// Wanneer een veilingwinnaar de 5d-betaaltermijn mist, krijgt de volgende
// hoogste bieder een 72u-offer (status AWAITING_DECISION). Hij kan accepteren
// (5d-betaalflow start) of weigeren (geen straf, volgende kandidaat krijgt
// offer). Tijdens 72u-window wordt GEEN reserve op de runner-up gelegd.

const PAYMENT_DEADLINE_DAYS_AFTER_ACCEPT = 5;

export async function getMyActiveRunnerUpOffer() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const offer = await prisma.auctionRunnerUpOffer.findFirst({
    where: { bidderId: session.user.id, status: "AWAITING_DECISION" },
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          imageUrls: true,
          deliveryMethod: true,
          sellerId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!offer) return null;

  const hasAddress =
    offer.deliveryChoice === "SHIP"
      ? await hasValidShippingAddress(session.user.id)
      : true;

  return {
    id: offer.id,
    auctionId: offer.auctionId,
    auctionTitle: offer.auction.title,
    auctionImageUrls: offer.auction.imageUrls,
    bidAmount: offer.bidAmount,
    premiumAmount: offer.premiumAmount,
    totalAmount: Math.round((offer.bidAmount + offer.premiumAmount) * 100) / 100,
    deliveryChoice: offer.deliveryChoice,
    decisionDeadline: offer.decisionDeadline,
    createdAt: offer.createdAt,
    requiresAddress: offer.deliveryChoice === "SHIP" && !hasAddress,
  };
}

export async function getActiveRunnerUpOffersForUser() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const offers = await prisma.auctionRunnerUpOffer.findMany({
    where: { bidderId: session.user.id, status: "AWAITING_DECISION" },
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          imageUrls: true,
          deliveryMethod: true,
          sellerId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasAddress = await hasValidShippingAddress(session.user.id);

  return offers.map((offer) => ({
    id: offer.id,
    auctionId: offer.auctionId,
    auctionTitle: offer.auction.title,
    auctionImageUrls: offer.auction.imageUrls,
    bidAmount: offer.bidAmount,
    premiumAmount: offer.premiumAmount,
    totalAmount: Math.round((offer.bidAmount + offer.premiumAmount) * 100) / 100,
    deliveryChoice: offer.deliveryChoice,
    decisionDeadline: offer.decisionDeadline,
    createdAt: offer.createdAt,
    requiresAddress: offer.deliveryChoice === "SHIP" && !hasAddress,
  }));
}

export async function acceptRunnerUpOffer(offerId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const offer = await prisma.auctionRunnerUpOffer.findUnique({
    where: { id: offerId },
    include: { auction: true },
  });
  if (!offer || offer.bidderId !== session.user.id) {
    return { error: "INVALID_OFFER" };
  }
  if (offer.status !== "AWAITING_DECISION") {
    return { error: "INVALID_OFFER" };
  }
  if (offer.decisionDeadline < new Date()) {
    return { error: "OFFER_EXPIRED" };
  }
  if (
    !offer.auction ||
    offer.auction.paymentStatus !== "AWAITING_RUNNER_UP_DECISION" ||
    offer.auction.winnerId !== session.user.id
  ) {
    return { error: "INVALID_AUCTION_STATE" };
  }

  // Adres-validatie voor SHIP. Bij PICKUP geen adres nodig.
  if (offer.deliveryChoice === "SHIP") {
    const hasAddress = await hasValidShippingAddress(session.user.id);
    if (!hasAddress) return { error: "NO_ADDRESS" };
  }

  const buyer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
      isVerified: true,
      isBusinessBidExempt: true,
    },
  });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  // Audit-fix: verified-gate-recheck. Als de runner-up bij placeBid verified
  // was maar tussentijds gedeverificeerd is door admin, mag hij geen ≥€2000-bid
  // accepteren (zelfde regel als placeBid). Anders kan een gedeverificeerde
  // user toch een hoge auction overnemen via de runner-up-flow.
  if (!bidPassesVerifiedGate(offer.bidAmount, buyer)) {
    return { error: "VERIFIED_REQUIRED_FOR_HIGH_BID" };
  }

  const newDeadline = new Date();
  newDeadline.setDate(newDeadline.getDate() + PAYMENT_DEADLINE_DAYS_AFTER_ACCEPT);

  // Audit-fix: race-safe atomic flip. Bij dubbel-klik / parallelle calls doen
  // beiden de findUnique-status-check en gaan dan beiden naar de tx. Eerste
  // updateMany flipt status naar ACCEPTED; tweede ziet count=0 (status al
  // ACCEPTED) → bail vóór bundle-create zodat we niet crashen op P2002 op
  // ShippingBundle.auctionId @unique.
  const offerClaim = await prisma.auctionRunnerUpOffer.updateMany({
    where: { id: offerId, status: "AWAITING_DECISION" },
    data: { status: "ACCEPTED", decidedAt: new Date() },
  });
  if (offerClaim.count === 0) {
    return { error: "INVALID_OFFER" };
  }

  // Auction-state flip — race-veilig tegen concurrent decline-cron of
  // parallelle accept op een ander offer (theoretisch onmogelijk want maar
  // één offer mag AWAITING_DECISION zijn, maar defense-in-depth).
  const auctionClaim = await prisma.auction.updateMany({
    where: { id: offer.auctionId, paymentStatus: "AWAITING_RUNNER_UP_DECISION" },
    data: {
      paymentStatus: "AWAITING_PAYMENT",
      paymentDeadline: newDeadline,
    },
  });
  if (auctionClaim.count === 0) {
    // Auction-status is intussen veranderd (bv. cron heeft 'm gefinaliseerd).
    // Roll de offer-flip terug zodat de staat consistent blijft.
    await prisma.auctionRunnerUpOffer.updateMany({
      where: { id: offerId, status: "ACCEPTED" },
      data: { status: "AWAITING_DECISION", decidedAt: null },
    });
    return { error: "INVALID_AUCTION_STATE" };
  }

  // Maak PENDING-bundle met deliveryChoice uit offer
  const offerDelivery = offer.deliveryChoice === "PICKUP" ? "PICKUP" : "SHIP";
  await createPendingBundle({
    buyerId: session.user.id,
    sellerId: offer.auction.sellerId,
    totalItemCost: offer.bidAmount,
    shippingCost: 0,
    auctionId: offer.auctionId,
    deliveryMethod: offerDelivery,
    address:
      offerDelivery === "SHIP" && buyer
        ? {
            street: buyer.street,
            houseNumber: buyer.houseNumber,
            postalCode: buyer.postalCode,
            city: buyer.city,
            country: buyer.country,
          }
        : undefined,
  });

  // Reserve nu 10% × (bid + premium) op runner-up — pas vanaf accept.
  await syncReservedBalance(session.user.id);

  await createNotification(
    offer.auction.sellerId,
    "ITEM_SOLD",
    "Runner-up heeft de veiling geaccepteerd",
    `"${offer.auction.title}" — de runner-up neemt de veiling over voor €${offer.bidAmount.toFixed(2)}. We wachten 5 dagen op betaling.`,
    `/nl/veilingen/${offer.auctionId}`,
  );
  await createNotification(
    session.user.id,
    "AUCTION_WON",
    "Aanbod geaccepteerd",
    `Je hebt "${offer.auction.title}" overgenomen voor €${offer.bidAmount.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
    `/nl/veilingen/${offer.auctionId}`,
  );

  publishMany(
    [userChannel(session.user.id), userChannel(offer.auction.sellerId)],
    { type: "balance-changed", payload: {} },
  );
  publish(userChannel(offer.auction.sellerId), {
    type: "auction-runner-up-decided",
    payload: { auctionId: offer.auctionId, status: "ACCEPTED" },
  });

  return { success: true };
}

export async function declineRunnerUpOffer(offerId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const offer = await prisma.auctionRunnerUpOffer.findUnique({
    where: { id: offerId },
    include: { auction: { select: { id: true, sellerId: true, title: true } } },
  });
  if (!offer || offer.bidderId !== session.user.id) {
    return { error: "INVALID_OFFER" };
  }
  if (offer.status !== "AWAITING_DECISION") {
    return { error: "INVALID_OFFER" };
  }

  // Audit-fix: race-safe atomic flip. Voorheen `update` zonder status-filter
  // kon een offer decline'n nadat een parallelle accept of cron-expire al de
  // status had gemuteerd — semantisch corrupt (auction al PAID/AWAITING_PAYMENT
  // maar offer status DECLINED). Bij race-loss bail vroegtijdig zodat
  // processRunnerUpDecision niet onnodig wordt aangeroepen.
  const claim = await prisma.auctionRunnerUpOffer.updateMany({
    where: { id: offerId, status: "AWAITING_DECISION" },
    data: { status: "DECLINED", decidedAt: new Date() },
  });
  if (claim.count === 0) {
    return { error: "INVALID_OFFER" };
  }

  if (offer.auction) {
    await createNotification(
      offer.auction.sellerId,
      "ITEM_SOLD",
      "Runner-up heeft afgewezen",
      `"${offer.auction.title}" — de runner-up heeft het aanbod afgewezen. We zoeken naar de volgende kandidaat.`,
      `/nl/veilingen/${offer.auction.id}`,
    );

    publish(userChannel(offer.auction.sellerId), {
      type: "auction-runner-up-decided",
      payload: { auctionId: offer.auctionId, status: "DECLINED" },
    });
  }

  // Schuif door naar volgende kandidaat (of finaliseer PAYMENT_FAILED)
  await processRunnerUpDecision(offer.auctionId, session.user.id);

  return { success: true };
}

/**
 * Status-aware update voor bestaande veilingen. Seller-only.
 *
 * Welke velden mogen worden gewijzigd hangt af van `computeEditScope`:
 *   FULL              — SCHEDULED + 0 bids: alles
 *   TIMING_LOCKED     — ACTIVE + 0 bids: alles behalve startTime/endTime
 *   DESCRIPTION_ONLY  — ACTIVE + ≥1 bid: alleen description + image-append + labels-add
 *   NONE              — ended/awaiting statussen: niets
 *
 * Race-safe: scope wordt zowel buiten als binnen de $transaction opnieuw
 * berekend zodat een bid die tussendoor binnenkomt verboden velden alsnog
 * blokkeert.
 *
 * v1-beperkingen (follow-ups):
 *   - shippingMethodIds wordt geaccepteerd maar nog niet verwerkt — seller die
 *     verzending wil veranderen moet annuleren-en-opnieuw (alleen mogelijk
 *     zonder biedingen).
 *   - upsell-toevoegen vanuit edit-flow is uit v1 gehaald (pro-rata cost-
 *     interactie met refundAuctionPromotion vereist apart ontwerp).
 */
export async function updateAuction(
  auctionId: string,
  formData: FormData,
): Promise<{ success: true } | { error: string; field?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // 1. Parse + valideer input
  const rawObj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") rawObj[key] = value;
  }
  const parsed = updateAuctionSchema.safeParse(rawObj);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Ongeldige invoer", field: first?.path?.join(".") };
  }
  const data = parsed.data;

  // 2. Load huidige veiling-state
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      sellerId: true,
      status: true,
      title: true,
      imageUrls: true,
      reservePrice: true,
      buyNowPrice: true,
      condition: true,
      auctionType: true,
      startingBid: true,
      startTime: true,
      endTime: true,
      _count: { select: { bids: true } },
    },
  });
  if (!auction) return { error: "Veiling niet gevonden" };
  if (auction.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };

  const scope: EditScope = computeEditScope(auction.status, auction._count.bids);
  if (scope === "NONE") {
    return { error: "Deze veiling kan niet meer aangepast worden" };
  }

  // 3. Per-veld scope-validatie (vóór tx zodat we user-friendly error geven
  //    in plaats van het hele patch silently te negeren)
  const fullOnlyFields: Array<keyof typeof data> = ["startTime", "endTime"];
  const replaceFields: Array<keyof typeof data> = [
    "title",
    "imageUrls",
    "cardItems",
    "estimatedCardCount",
    "conditionRange",
    "productType",
    "itemCategory",
    "startingBid",
    "reservePrice",
    "buyNowPrice",
    "pickupCity",
    "shippingMethodIds",
  ];

  if (scope !== "FULL") {
    for (const f of fullOnlyFields) {
      if (data[f] !== undefined) {
        return {
          error: "Het tijdvenster kan niet meer gewijzigd worden — de veiling is al gestart",
          field: f,
        };
      }
    }
  }
  if (scope === "DESCRIPTION_ONLY") {
    for (const f of replaceFields) {
      if (data[f] !== undefined) {
        return {
          error: "Dit veld kan niet meer gewijzigd worden — er is al een bod uitgebracht",
          field: f,
        };
      }
    }
  }

  // 4. Cross-field re-check: schema's superRefine vergelijkt alleen velden die
  //    in dezelfde submit zitten. We re-checken ook tegen DB-waarden (seller
  //    kan reservePrice los wijzigen zonder buyNowPrice mee te sturen).
  const effectiveStarting = data.startingBid ?? auction.startingBid;
  const effectiveReserve = data.reservePrice ?? auction.reservePrice ?? 0;
  const effectiveBuyNow = data.buyNowPrice ?? auction.buyNowPrice ?? 0;
  if (effectiveBuyNow > 0 && effectiveBuyNow <= effectiveStarting) {
    return { error: "Buy Now-prijs moet hoger zijn dan het startbod", field: "buyNowPrice" };
  }
  if (effectiveReserve > 0 && effectiveReserve < effectiveStarting) {
    return { error: "Reserveprijs mag niet lager zijn dan het startbod", field: "reservePrice" };
  }
  if (effectiveBuyNow > 0 && effectiveReserve > 0 && effectiveBuyNow <= effectiveReserve) {
    return { error: "Direct Kopen-prijs moet hoger zijn dan de reserveprijs", field: "buyNowPrice" };
  }

  // 5. Timing-update (alleen FULL). De edit-drawer stuurt alleen endTime —
  //    startTime is locked. Maar voor toekomstige flexibiliteit accepteren we
  //    beide. Recompute `duration` afgeleid + status-flip naar ACTIVE als
  //    startTime intussen voorbij de threshold ligt.
  let timingPatch: { startTime?: Date; endTime?: Date; duration?: number; status?: "ACTIVE" } = {};
  if (scope === "FULL" && (data.startTime !== undefined || data.endTime !== undefined)) {
    const newStart = data.startTime ?? auction.startTime ?? new Date();
    const newEnd = data.endTime ?? auction.endTime;
    const diffMs = newEnd.getTime() - newStart.getTime();
    if (diffMs < 60 * 60 * 1000) {
      return { error: "De veiling moet minstens een uur duren", field: "endTime" };
    }
    if (diffMs >= 15 * 24 * 60 * 60 * 1000) {
      return { error: "Een veiling mag niet 15 dagen of langer duren", field: "endTime" };
    }
    if (newEnd.getTime() <= Date.now()) {
      return { error: "Eindtijd mag niet in het verleden liggen", field: "endTime" };
    }
    if (data.startTime !== undefined) timingPatch.startTime = data.startTime;
    if (data.endTime !== undefined) timingPatch.endTime = data.endTime;
    timingPatch.duration = deriveDurationDays(newStart, newEnd);
    if (newStart.getTime() <= Date.now() + SCHEDULED_THRESHOLD_MS) {
      timingPatch.status = "ACTIVE";
    }
  }

  // 6. Labels-add validatie + cost
  let parsedNewLabels: Array<{ type: LabelType; colorKey: LabelColor }> = [];
  let labelsCost = 0;
  if (data.addLabels) {
    try {
      const raw = JSON.parse(data.addLabels);
      if (!Array.isArray(raw)) {
        return { error: "Ongeldige labels-payload", field: "addLabels" };
      }
      const cleaned = raw.filter(
        (l: unknown): l is { type: string; colorKey: string } =>
          typeof l === "object" &&
          l !== null &&
          "type" in l &&
          "colorKey" in l &&
          typeof (l as { type: unknown }).type === "string" &&
          typeof (l as { colorKey: unknown }).colorKey === "string",
      );

      const validated: Array<{ type: LabelType; colorKey: LabelColor }> = [];
      const seen = new Set<string>();
      for (const l of cleaned) {
        if (!isValidLabelType(l.type) || !isValidLabelColor(l.colorKey)) continue;
        if (seen.has(l.type)) continue;
        seen.add(l.type);
        validated.push({ type: l.type, colorKey: l.colorKey });
      }

      // Anti-tamper: alleen labels die in availableLabelsFor() zitten voor deze
      // veiling. Refresh's `condition`/`auctionType` zijn DB-waarden, geen input.
      const avail = availableLabelsFor({
        reservePrice: effectiveReserve > 0 ? effectiveReserve : null,
        buyNowPrice: effectiveBuyNow > 0 ? effectiveBuyNow : null,
        condition: auction.condition,
        auctionType: auction.auctionType,
      });
      const availSet = new Set(avail.filter((a) => a.available).map((a) => a.type));
      for (const l of validated) {
        if (!availSet.has(l.type)) {
          return { error: `Label "${l.type}" is niet beschikbaar voor deze veiling`, field: "addLabels" };
        }
      }

      const existingCount = await prisma.auctionLabel.count({ where: { auctionId } });
      if (existingCount + validated.length > MAX_LABELS_PER_AUCTION) {
        return {
          error: `Maximaal ${MAX_LABELS_PER_AUCTION} labels per veiling`,
          field: "addLabels",
        };
      }

      parsedNewLabels = validated;
      // Bundle-tarief: cost van DE TOTALE labels-stand na deze toevoeging,
      // minus wat seller eerder al heeft betaald (eerste label €0,99, twee €1,69).
      const newTotalCount = existingCount + validated.length;
      const newTotalCost = calculateLabelCost(newTotalCount);
      const existingCost = await prisma.auctionLabel
        .findMany({ where: { auctionId }, select: { cost: true } })
        .then((rows) => rows.reduce((s, r) => s + (r.cost ?? 0), 0));
      labelsCost = Math.max(0, Math.round((newTotalCost - existingCost) * 100) / 100);

      if (labelsCost > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true, reservedBalance: true },
        });
        const availableBalance = (seller?.balance ?? 0) - (seller?.reservedBalance ?? 0);
        if (labelsCost > availableBalance) {
          return { error: "Onvoldoende saldo voor extra labels" };
        }
      }
    } catch {
      return { error: "Kon labels-payload niet parsen", field: "addLabels" };
    }
  }

  // 7. Atomic update binnen $transaction met race-check op scope
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({
      where: { id: auctionId },
      select: { status: true, imageUrls: true, _count: { select: { bids: true } } },
    });
    if (!fresh) return { error: "Veiling niet gevonden" } as const;
    const freshScope = computeEditScope(fresh.status, fresh._count.bids);
    if (freshScope === "NONE") return { error: "Veiling kan niet meer aangepast worden" } as const;

    // Als scope intussen versmald is (bv. nieuwe bid binnen race-window),
    // moeten velden die in fresh-scope niet meer mogen, geweigerd worden.
    if (scope === "FULL" && freshScope !== "FULL") {
      for (const f of fullOnlyFields) {
        if (data[f] !== undefined) {
          return { error: "Er is intussen een bod gedaan — tijdvenster is nu vergrendeld" } as const;
        }
      }
    }
    if (scope !== "DESCRIPTION_ONLY" && freshScope === "DESCRIPTION_ONLY") {
      for (const f of replaceFields) {
        if (data[f] !== undefined) {
          return { error: "Er is intussen een bod gedaan — dit veld is nu vergrendeld" } as const;
        }
      }
    }

    // Bouw dataPatch gefilterd op freshScope
    const dataPatch: Record<string, unknown> = {};

    if (data.description !== undefined) dataPatch.description = data.description.trim();

    // Image-append (alle scopes — additive, geen remove)
    if (data.appendImageUrls) {
      try {
        const existing = fresh.imageUrls ? (JSON.parse(fresh.imageUrls) as string[]) : [];
        const toAppend = JSON.parse(data.appendImageUrls) as string[];
        if (!Array.isArray(toAppend)) throw new Error("not-array");
        dataPatch.imageUrls = JSON.stringify([...existing, ...toAppend]);
      } catch {
        return { error: "Kon foto's-payload niet parsen" } as const;
      }
    }

    if (freshScope !== "DESCRIPTION_ONLY") {
      if (data.title !== undefined) dataPatch.title = data.title;
      if (data.imageUrls !== undefined) dataPatch.imageUrls = data.imageUrls; // full-replace overschrijft append
      if (data.cardItems !== undefined) dataPatch.cardItems = data.cardItems;
      if (data.estimatedCardCount !== undefined) dataPatch.estimatedCardCount = data.estimatedCardCount;
      if (data.conditionRange !== undefined) dataPatch.conditionRange = data.conditionRange;
      if (data.productType !== undefined) dataPatch.productType = data.productType;
      if (data.itemCategory !== undefined) dataPatch.itemCategory = data.itemCategory;
      if (data.startingBid !== undefined) dataPatch.startingBid = data.startingBid;
      if (data.reservePrice !== undefined) dataPatch.reservePrice = data.reservePrice > 0 ? data.reservePrice : null;
      if (data.buyNowPrice !== undefined) dataPatch.buyNowPrice = data.buyNowPrice > 0 ? data.buyNowPrice : null;
      if (data.pickupCity !== undefined) dataPatch.pickupCity = data.pickupCity || null;
    }

    if (freshScope === "FULL") {
      if (timingPatch.startTime) dataPatch.startTime = timingPatch.startTime;
      if (timingPatch.endTime) dataPatch.endTime = timingPatch.endTime;
      if (timingPatch.duration !== undefined) dataPatch.duration = timingPatch.duration;
      if (timingPatch.status) dataPatch.status = timingPatch.status;
    }

    // Niets te updaten? Dan is alleen labels-add van toepassing (of niets) —
    // schip het atomic-update-call.
    let updateAttempted = false;
    if (Object.keys(dataPatch).length > 0) {
      updateAttempted = true;
      // Race-gated: status van fresh moet binnen allowed-set blijven
      const allowedStatuses =
        freshScope === "FULL" ? ["SCHEDULED"] : ["ACTIVE"];
      const flipped = await tx.auction.updateMany({
        where: { id: auctionId, status: { in: allowedStatuses } },
        data: dataPatch,
      });
      if (flipped.count === 0) {
        return { error: "Veiling kon niet bijgewerkt worden — status is gewijzigd" } as const;
      }
    }

    // Labels-add binnen tx (na auction-update zodat we niet inserten bij race-fail)
    if (parsedNewLabels.length > 0) {
      const totalAfter = await tx.auctionLabel.count({ where: { auctionId } });
      if (totalAfter + parsedNewLabels.length > MAX_LABELS_PER_AUCTION) {
        return { error: `Maximaal ${MAX_LABELS_PER_AUCTION} labels per veiling` } as const;
      }
      const perLabelCost =
        parsedNewLabels.length > 0 ? Math.round((labelsCost / parsedNewLabels.length) * 100) / 100 : 0;
      await tx.auctionLabel.createMany({
        data: parsedNewLabels.map((l) => ({
          auctionId,
          type: l.type,
          colorKey: l.colorKey,
          cost: perLabelCost,
        })),
      });
    }

    return { success: true, updateAttempted } as const;
  });

  if ("error" in result) return result;

  // 8. Labels-cost buiten tx deducten. deductBalance opent eigen tx en throws
  //    bij insufficient balance — we hebben dat al boven gecheckt maar fang
  //    de error toch op zodat een ultra-rare race tussen check en deduct geen
  //    crash geeft (labels staan dan al in DB, seller krijgt ze gratis — niet
  //    erg, beter dan rollback met label-delete).
  if (labelsCost > 0) {
    try {
      await deductBalance(
        session.user.id,
        labelsCost,
        "UPSELL",
        `Extra labels veiling: ${auction.title}`,
        auctionId,
      );
    } catch (err) {
      console.error(`[updateAuction] Labels deduct failed na succesvolle insert voor auction ${auctionId}:`, err);
    }
  }

  // 9. Real-time publish
  publishMany(
    [auctionChannel(auctionId), userChannel(session.user.id)],
    { type: "auction-updated", payload: { auctionId } },
  );

  return { success: true };
}
