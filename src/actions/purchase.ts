"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundEscrow, releaseEscrow, partialRefundEscrow } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";

const CANCEL_DAYS = 7;
const AUTO_CONFIRM_DAYS = 30;

// Buyer cancels purchase (after 7 days without shipping)
export async function cancelPurchase(bundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: { seller: { select: { displayName: true } } },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "PAID") return { error: "Kan alleen betaalde bestellingen annuleren" };

  // Check if 7 days have passed since purchase
  const daysSincePurchase = (Date.now() - bundle.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePurchase < CANCEL_DAYS) {
    return { error: "CANCEL_TOO_EARLY", daysRemaining: Math.ceil(CANCEL_DAYS - daysSincePurchase) };
  }

  // Refund: release escrow back to buyer
  await refundEscrow(
    bundle.sellerId,
    session.user.id,
    bundle.totalCost,       // full refund to buyer (items + shipping)
    bundle.totalItemCost,   // only item costs were in seller's escrow
    `Geannuleerd: bestelling bij ${bundle.seller.displayName}`,
    bundle.id
  );

  // Set items back to AVAILABLE
  await prisma.claimsaleItem.updateMany({
    where: { shippingBundleId: bundle.id },
    data: {
      status: "AVAILABLE",
      buyerId: null,
      shippingBundleId: null,
    },
  });

  // Mark bundle as cancelled
  await prisma.shippingBundle.update({
    where: { id: bundleId },
    data: { status: "CANCELLED" },
  });

  // Notify seller
  await createNotification(
    bundle.sellerId,
    "ORDER_CANCELLED",
    "Bestelling geannuleerd",
    `De koper heeft de bestelling geannuleerd omdat deze niet binnen 7 dagen is verzonden.`,
    "/dashboard/claimsales"
  );

  return { success: true };
}

// Seller cancels a PAID order (refund to buyer)
export async function cancelOrderBySeller(bundleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: { buyer: { select: { displayName: true } } },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "PAID") return { error: "Kan alleen betaalde bestellingen annuleren" };

  // Refund buyer: release escrow back to buyer
  await refundEscrow(
    session.user.id,        // seller
    bundle.buyerId,         // buyer gets refund
    bundle.totalCost,       // full refund (items + shipping)
    bundle.totalItemCost,   // item costs in escrow
    `Geannuleerd door verkoper: bestelling ${bundle.id}`,
    bundle.id
  );

  // Set claimsale items back to AVAILABLE
  await prisma.claimsaleItem.updateMany({
    where: { shippingBundleId: bundle.id },
    data: {
      status: "AVAILABLE",
      buyerId: null,
      shippingBundleId: null,
    },
  });

  // Mark bundle as cancelled
  await prisma.shippingBundle.update({
    where: { id: bundleId },
    data: { status: "CANCELLED" },
  });

  // Notify buyer
  await createNotification(
    bundle.buyerId,
    "ORDER_CANCELLED",
    "Bestelling geannuleerd door verkoper",
    "De verkoper heeft je bestelling geannuleerd. Het volledige bedrag is teruggestort op je saldo.",
    "/dashboard/aankopen"
  );

  return { success: true };
}

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
  const { buildTrackingUrl } = await import("@/lib/shipping/carriers");
  const resolvedCarrier = carrierId ?? bundle.shippingMethod?.carrier ?? null;
  const resolvedCountry = buyerCountry ?? bundle.buyerCountry ?? "NL";
  const resolvedPostalCode = buyerPostalCode ?? bundle.buyerPostalCode ?? "";

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

  // Release escrow to seller
  await releaseEscrow(
    bundle.sellerId,
    bundle.totalItemCost,
    `Bezorgd bevestigd: bestelling ${bundle.id}`,
    bundle.id
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

    // Release escrow to seller
    await releaseEscrow(
      bundle.sellerId,
      bundle.totalItemCost,
      `Auto-bevestigd na ${AUTO_CONFIRM_DAYS} dagen: bestelling ${bundle.id}`,
      bundle.id
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
    // Calculate how much to deduct from seller's escrow (proportional to item cost)
    const totalEscrowRemaining = bundle.totalItemCost - (bundle.refundedAmount > bundle.shippingCost
      ? bundle.refundedAmount - bundle.shippingCost
      : 0);
    const escrowDeduction = refundAmount >= maxRefundable
      ? totalEscrowRemaining
      : Math.min(refundAmount, totalEscrowRemaining);

    await partialRefundEscrow(
      session.user.id,
      bundle.buyerId,
      refundAmount,
      escrowDeduction,
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
    if (seller.balance < refundAmount) {
      return { error: "Onvoldoende saldo om deze terugbetaling uit te voeren. Stort eerst saldo bij." };
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
