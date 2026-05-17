"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundEscrow, releaseEscrow, partialRefundEscrow } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { publish, userChannel } from "@/lib/realtime";

function publishBundleChanged(buyerId: string, sellerId: string, bundleId: string, status: string) {
  for (const uid of [buyerId, sellerId]) {
    publish(userChannel(uid), { type: "bundle-changed", payload: { bundleId, status } });
  }
}

const AUTO_CONFIRM_DAYS = 30;

// Direct-cancel-actions BESTAAN BEWUST NIET MEER (Fase 28). Beide partijen
// hebben vanaf het moment van betalen een bindende overeenkomst. Annuleren
// kan alleen via `requestCancellation` (cancellation.ts) — de wederpartij
// moet akkoord geven, of na 7 dagen verloopt het verzoek. Vóór Fase 28 kon
// de seller direct annuleren zonder buyer-akkoord en de buyer pas na 7d —
// die asymmetrie schond de leverplicht en is volledig vervangen door de
// mutual-akkoord-flow.

// Seller marks bundle as shipped with tracking URL
export async function markAsShipped(
  bundleId: string,
  trackingNumber: string,
  proofUrls?: string[],
  carrierId?: string,
  buyerCountry?: string,
  buyerPostalCode?: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: {
      seller: { select: { displayName: true } },
      shippingMethod: { select: { isTracked: true, carrier: true } },
    },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "PAID") return { error: "Kan alleen betaalde bestellingen als verzonden markeren" };
  // Fase 27: pickup-bundles verzenden niet — die worden via confirmPickup afgehandeld.
  if (bundle.paymentMode === "EXTERNAL") {
    return { error: "Ophaal-bestellingen worden afgehandeld via de ophaal-code in /dashboard/verkopen" };
  }

  const isBriefpost = bundle.shippingMethod ? !bundle.shippingMethod.isTracked : false;

  if (isBriefpost) {
    // Briefpost: proof photos required, tracking number optional
    if (!proofUrls || proofUrls.length === 0) {
      return { error: "Bij briefpost is minimaal 1 verzendbewijs foto verplicht (foto van brief met inhoud)." };
    }
  } else {
    // Tracked: tracking number required
    if (!trackingNumber || !trackingNumber.trim()) {
      return { error: "Een trackingnummer is verplicht" };
    }
  }

  const trimmedNumber = trackingNumber?.trim() || null;

  // Build tracking URL from carrier + number + buyer address
  const { buildTrackingUrl, getCarrierById } = await import("@/lib/shipping/carriers");
  const { validateTrackingNumber } = await import("@/lib/shipping/tracking-validation");
  const resolvedCarrier = carrierId ?? bundle.shippingMethod?.carrier ?? null;
  const resolvedCountry = buyerCountry ?? bundle.buyerCountry ?? "NL";
  const resolvedPostalCode = buyerPostalCode ?? bundle.buyerPostalCode ?? "";

  // Fase 40 — server-side tracking-validatie. Bij hit: hard-block met user-
  // friendly bericht; voorkomt dat verkoper een typo aanlevert en koper
  // achteraf in een dispute belandt omdat tracking niet werkt.
  if (trimmedNumber && !isBriefpost) {
    const validation = validateTrackingNumber(resolvedCarrier, trimmedNumber);
    if (!validation.ok) {
      return { error: validation.message ?? "Trackingnummer is niet geldig" };
    }
  }

  // Fase 40 — PostNL fix: PostNL vereist postcode in de URL. Als die ontbreekt
  // krijgt de buyer een halve URL "...track-and-trace/3SABC-NL-" die niet
  // werkt. Bij PostNL + lege postcode: blokkeer markAsShipped met duidelijke
  // melding zodat seller eerst de adres-koppeling controleert.
  if (resolvedCarrier === "POSTNL" && !resolvedPostalCode) {
    const carrier = getCarrierById(resolvedCarrier);
    if (carrier?.needsPostalCode) {
      return {
        error:
          "PostNL-tracking vereist de postcode van de koper, maar die ontbreekt op deze bestelling. Controleer het verzendadres in de bestelling, of kies een andere vervoerder.",
      };
    }
  }

  let trackingUrl: string | null = null;
  if (trimmedNumber && resolvedCarrier) {
    trackingUrl = buildTrackingUrl(resolvedCarrier, trimmedNumber, resolvedCountry, resolvedPostalCode);
  }
  // Fallback: if no carrier URL pattern, store the number as-is
  if (!trackingUrl && trimmedNumber) {
    trackingUrl = trimmedNumber;
  }

  await prisma.shippingBundle.update({
    where: { id: bundleId },
    data: {
      status: "SHIPPED",
      trackingUrl,
      shippingProofUrls: proofUrls && proofUrls.length > 0 ? JSON.stringify(proofUrls) : null,
      shippedAt: new Date(),
      // Defensive lock: ook als seller niet expliciet vergrendelde, is een
      // verzonden bundle per definitie niet meer uit te breiden.
      lockedForPackingAt: bundle.lockedForPackingAt ?? new Date(),
    },
  });

  // Notify buyer
  await createNotification(
    bundle.buyerId,
    "ORDER_SHIPPED",
    "Je bestelling is verzonden!",
    `${bundle.seller.displayName} heeft je bestelling verzonden.${trackingUrl ? " Volg je pakket via de trackinglink." : ""}`,
    "/dashboard/aankopen"
  );

  publishBundleChanged(bundle.buyerId, bundle.sellerId, bundleId, "SHIPPED");

  return { success: true };
}

/**
 * Seller-only: vergrendel een PAID-bundle zodat een koper bij een volgende
 * claimsale-checkout geen items meer kan toevoegen. Bedoeld om te klikken
 * vóór je begint met inpakken. markAsShipped doet dit auto, dus alleen
 * relevant in de window tussen "klaar voor inpakken" en "verzonden".
 *
 * Race-safe via conditional updateMany. Dubbel-klikken is geen probleem —
 * tweede klik retourneert success met dezelfde lock-timestamp.
 */
export async function lockBundleForPacking(bundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    select: { sellerId: true, status: true, lockedForPackingAt: true, buyerId: true },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "PAID") return { error: "Alleen PAID-bestellingen kunnen vergrendeld worden" };
  if (bundle.lockedForPackingAt !== null) return { success: true }; // idempotent

  await prisma.shippingBundle.updateMany({
    where: { id: bundleId, lockedForPackingAt: null, status: "PAID" },
    data: { lockedForPackingAt: new Date() },
  });

  publishBundleChanged(bundle.buyerId, bundle.sellerId, bundleId, "PAID");

  return { success: true };
}

// Buyer confirms delivery (with optional review)
export async function confirmDelivery(
  bundleId: string,
  review?: {
    packagingRating: number;
    shippingRating: number;
    communicationRating: number;
    comment?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: { seller: { select: { displayName: true } } },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "SHIPPED") return { error: "Bestelling is nog niet verzonden" };

  // Mark as completed
  await prisma.shippingBundle.update({
    where: { id: bundleId },
    data: {
      status: "COMPLETED",
      deliveredAt: new Date(),
    },
  });

  // Release escrow to seller. Met de Fase-28 escrow-flow zit de hele
  // bundle.totalCost (items + verzending) in heldBalance. Bij delivery komt
  // het resterende deel (na eventuele partial refunds) vrij. Commissie wordt
  // alleen over het item-deel berekend; verzending is fee-vrij voor seller.
  // Refunds worden conservatief eerst van items afgeschreven (commissieBase
  // krimpt), pas overshoot raakt shipping.
  const releaseAmount = Math.max(0, bundle.totalCost - bundle.refundedAmount);
  const commissionableAmount = Math.max(0, bundle.totalItemCost - bundle.refundedAmount);
  await releaseEscrow(
    bundle.sellerId,
    releaseAmount,
    `Bezorgd bevestigd: bestelling ${bundle.id}`,
    bundle.id,
    commissionableAmount,
  );

  // Create review if provided
  if (review) {
    const avgRating = Math.round(
      (review.packagingRating + review.shippingRating + review.communicationRating) / 3
    );

    await prisma.review.create({
      data: {
        rating: avgRating,
        packagingRating: review.packagingRating,
        shippingRating: review.shippingRating,
        communicationRating: review.communicationRating,
        comment: review.comment || null,
        reviewerId: session.user.id,
        sellerId: bundle.sellerId,
        shippingBundleId: bundle.id,
      },
    });
  }

  // Notify seller
  await createNotification(
    bundle.sellerId,
    "ORDER_COMPLETED",
    "Bezorging bevestigd!",
    `De koper heeft de ontvangst van de bestelling bevestigd. Het bedrag is vrijgegeven.`,
    "/dashboard/claimsales"
  );

  // Award Ember for completed purchase (buyer) and sale (seller)
  const { logActivity } = await import("@/actions/activity");
  logActivity(session.user.id, "COMPLETE_PURCHASE", { bundleId });
  logActivity(bundle.sellerId, "COMPLETE_SALE", { bundleId });

  // Recompute achievements for both parties
  const { checkAchievements } = await import("@/lib/achievements");
  void checkAchievements(session.user.id);
  void checkAchievements(bundle.sellerId);

  publishBundleChanged(bundle.buyerId, bundle.sellerId, bundleId, "COMPLETED");

  return { success: true };
}

// Auto-confirm deliveries after 30 days (called by cron/API)
export async function autoConfirmDeliveries() {
  const cutoffDate = new Date(Date.now() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000);

  const expiredBundles = await prisma.shippingBundle.findMany({
    where: {
      status: "SHIPPED",
      shippedAt: { lte: cutoffDate },
      dispute: null, // Skip bundles with active disputes
    },
  });

  let confirmed = 0;

  for (const bundle of expiredBundles) {
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: {
        status: "COMPLETED",
        deliveredAt: new Date(),
      },
    });

    // Release escrow to seller — refund-aware (zelfde berekening als confirmDelivery)
    const releaseAmount = Math.max(0, bundle.totalCost - bundle.refundedAmount);
    const commissionableAmount = Math.max(0, bundle.totalItemCost - bundle.refundedAmount);
    await releaseEscrow(
      bundle.sellerId,
      releaseAmount,
      `Auto-bevestigd na ${AUTO_CONFIRM_DAYS} dagen: bestelling ${bundle.id}`,
      bundle.id,
      commissionableAmount,
    );

    // Notify both parties
    await createNotification(
      bundle.buyerId,
      "ORDER_AUTO_CONFIRMED",
      "Bestelling automatisch afgerond",
      "Je bestelling is automatisch als bezorgd gemarkeerd na 30 dagen.",
      "/dashboard/aankopen"
    );

    await createNotification(
      bundle.sellerId,
      "ORDER_COMPLETED",
      "Bestelling automatisch afgerond",
      "Een bestelling is automatisch als bezorgd gemarkeerd na 30 dagen. Het bedrag is vrijgegeven.",
      "/dashboard/claimsales"
    );

    // Recompute achievements for both parties
    const { checkAchievements } = await import("@/lib/achievements");
    void checkAchievements(bundle.buyerId);
    void checkAchievements(bundle.sellerId);

    publishBundleChanged(bundle.buyerId, bundle.sellerId, bundle.id, "COMPLETED");

    confirmed++;
  }

  return { confirmed };
}

// Window waarin een verkoper na delivery nog een refund kan uitgeven zonder
// dispute-flow. Voor Cardmarket-stijl coulance: 30 dagen na deliveredAt op
// COMPLETED-bundles. Daarna alleen via dispute-flow.
const COMPLETED_REFUND_WINDOW_DAYS = 30;

// Seller issues a (partial) refund — manueel bedrag + optionele reden.
// Twee paden:
//  - SHIPPED: deduct van seller's heldBalance (escrow nog actief)
//  - COMPLETED binnen 30d na deliveredAt: deduct van seller's balance
//    (escrow al released; refund gaat uit eigen zak — commissie blijft betaald)
export async function issueSellerRefund(bundleId: string, amount: number, reason?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (!amount || amount <= 0) return { error: "Ongeldig bedrag" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: { buyer: { select: { displayName: true } } },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };

  // Status-gate: SHIPPED altijd, COMPLETED alleen binnen 30d na delivery.
  const isShipped = bundle.status === "SHIPPED";
  const isCompletedInWindow =
    bundle.status === "COMPLETED"
    && bundle.deliveredAt !== null
    && Date.now() - bundle.deliveredAt.getTime() <= COMPLETED_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (!isShipped && !isCompletedInWindow) {
    if (bundle.status === "COMPLETED") {
      return { error: `Refund is alleen mogelijk binnen ${COMPLETED_REFUND_WINDOW_DAYS} dagen na levering. Open een geschil voor latere claims.` };
    }
    return { error: "Refund is alleen mogelijk op verzonden of recent geleverde bestellingen" };
  }

  const maxRefundable = bundle.totalCost - bundle.refundedAmount;
  if (maxRefundable <= 0) return { error: "Deze bestelling is al volledig terugbetaald" };

  // Round to 2 decimals
  const refundAmount = Math.min(Math.round(amount * 100) / 100, Math.round(maxRefundable * 100) / 100);
  if (refundAmount <= 0) return { error: "Ongeldig bedrag" };

  const reasonSnippet = reason && reason.trim().length > 0 ? ` — ${reason.trim().slice(0, 120)}` : "";
  const description = `Terugbetaling door verkoper: bestelling ${bundle.orderNumber}${reasonSnippet}`;

  if (isShipped) {
    // Sinds Fase 28 zit de hele bundle.totalCost in seller's heldBalance, dus
    // is het escrow-decrement simpelweg gelijk aan het refund-bedrag — geen
    // proportionele berekening meer nodig. partialRefundEscrow clamp't
    // automatisch op heldBalance ≥ 0 als safety-net voor pre-Fase-28 bundles.
    await partialRefundEscrow(
      session.user.id,
      bundle.buyerId,
      refundAmount,
      refundAmount,
      description,
      bundle.id,
    );
  } else {
    // COMPLETED-pad: escrow is al released. Deduct rechtstreeks van seller.balance,
    // krediteer buyer.balance, log één Transaction-rij voor buyer (audit-trail in
    // refund-history). Seller-side Transaction wordt apart gelogd.
    const [buyer, seller] = await Promise.all([
      prisma.user.findUnique({ where: { id: bundle.buyerId } }),
      prisma.user.findUnique({ where: { id: session.user.id } }),
    ]);
    if (!buyer || !seller) return { error: "Gebruiker niet gevonden" };
    // Beschikbaar saldo = balance − reservedBalance (15%-reserves voor actieve bids — Fase 29).
    // Refund mag deze niet onder 0 trekken; anders raken seller's auction-reserves
    // onderdekkend en kunnen winning-bid-betalingen later falen.
    const sellerAvailable = seller.balance - seller.reservedBalance;
    if (sellerAvailable < refundAmount) {
      return {
        error: `Onvoldoende beschikbaar saldo om deze terugbetaling uit te voeren. Beschikbaar: €${sellerAvailable.toFixed(2)}. Stort eerst saldo bij.`,
      };
    }

    const buyerBefore = buyer.balance;
    const sellerBefore = seller.balance;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: buyer.id },
        data: { balance: buyerBefore + refundAmount },
      }),
      prisma.transaction.create({
        data: {
          userId: buyer.id,
          type: "PURCHASE",
          amount: refundAmount,
          balanceBefore: buyerBefore,
          balanceAfter: buyerBefore + refundAmount,
          description,
          relatedShippingBundleId: bundle.id,
        },
      }),
      prisma.user.update({
        where: { id: seller.id },
        data: { balance: sellerBefore - refundAmount },
      }),
      prisma.transaction.create({
        data: {
          userId: seller.id,
          type: "SALE",
          amount: -refundAmount,
          balanceBefore: sellerBefore,
          balanceAfter: sellerBefore - refundAmount,
          description: `Terugbetaling aan koper: bestelling ${bundle.orderNumber}${reasonSnippet}`,
          relatedShippingBundleId: bundle.id,
        },
      }),
    ]);
  }

  // Update refunded amount op bundle (geldt voor beide paden)
  await prisma.shippingBundle.update({
    where: { id: bundleId },
    data: { refundedAmount: bundle.refundedAmount + refundAmount },
  });

  // Notify buyer
  await createNotification(
    bundle.buyerId,
    "ORDER_REFUND",
    "Terugbetaling ontvangen",
    `De verkoper heeft €${refundAmount.toFixed(2)} terugbetaald voor bestelling ${bundle.orderNumber}.`,
    "/dashboard/aankopen",
  );

  return { success: true, refundedAmount: refundAmount };
}
