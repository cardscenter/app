"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundEscrow } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { z } from "zod";

const CANCELLATION_DEADLINE_DAYS = 7;

export const CANCELLATION_REASONS = [
  "BUYER_CHANGED_MIND",
  "SELLER_OUT_OF_STOCK",
  "DAMAGED",
  "UNRESPONSIVE",
  "OTHER",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

const requestSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  details: z.string().max(1000).optional(),
});

export async function requestCancellation(bundleId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const parsed = requestSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
    include: {
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };

  // Only buyer of seller op deze bundle kunnen annuleren.
  const isBuyer = bundle.buyerId === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  // Cancel werkt alleen op een PAID bundle. SHIPPED → dispute. CANCELLED/
  // COMPLETED → niets meer te annuleren.
  if (bundle.status !== "PAID") {
    return { error: "Annuleren is alleen mogelijk vóór verzending. Gebruik anders een geschil." };
  }

  // Eén actief verzoek per bundle.
  const existing = await prisma.cancellationRequest.findFirst({
    where: { shippingBundleId: bundleId, status: "PENDING" },
  });
  if (existing) {
    return { error: "Er is al een openstaand annuleringsverzoek voor deze bestelling." };
  }

  const expiresAt = new Date(Date.now() + CANCELLATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.cancellationRequest.create({
    data: {
      shippingBundleId: bundleId,
      proposedById: session.user.id,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
      expiresAt,
    },
  });

  // Notify the OTHER party.
  const recipient = isBuyer ? bundle.sellerId : bundle.buyerId;
  await createNotification(
    recipient,
    "NEW_MESSAGE",
    "Annuleringsverzoek ontvangen",
    `${isBuyer ? bundle.buyer.displayName : bundle.seller.displayName} heeft een annuleringsverzoek ingediend voor bestelling ${bundle.orderNumber}. Reageer binnen 7 dagen.`,
    "/dashboard/aankopen"
  );

  return { success: true };
}

export async function respondToCancellation(
  requestId: string,
  action: "ACCEPT" | "REJECT",
  rejectionNote?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const req = await prisma.cancellationRequest.findUnique({
    where: { id: requestId },
    include: {
      shippingBundle: {
        include: {
          buyer: { select: { displayName: true } },
          seller: { select: { displayName: true } },
        },
      },
      proposedBy: { select: { displayName: true } },
    },
  });
  if (!req) return { error: "Verzoek niet gevonden" };
  if (req.status !== "PENDING") return { error: "Verzoek is al afgehandeld" };
  if (new Date() > req.expiresAt) {
    return { error: "Het verzoek is verlopen" };
  }

  // Wederpartij reageert — niet de proposer zelf.
  if (req.proposedById === session.user.id) {
    return { error: "Je kunt je eigen verzoek niet beantwoorden" };
  }

  const bundle = req.shippingBundle;
  const isParticipant = bundle.buyerId === session.user.id || bundle.sellerId === session.user.id;
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  if (action === "REJECT") {
    await prisma.cancellationRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
        respondedById: session.user.id,
        rejectionNote: rejectionNote?.trim() || null,
      },
    });

    await createNotification(
      req.proposedById,
      "NEW_MESSAGE",
      "Annuleringsverzoek afgewezen",
      `Je annuleringsverzoek voor bestelling ${bundle.orderNumber} is afgewezen.${rejectionNote ? ` Reden: ${rejectionNote}` : ""}`,
      "/dashboard/aankopen"
    );

    return { success: true, status: "REJECTED" };
  }

  // ACCEPT: refund + bundle CANCELLED + items reset.
  // Bundle moet nog PAID zijn (defensief).
  if (bundle.status !== "PAID") {
    return { error: "Bestelling is niet meer in PAID status" };
  }

  await refundEscrow(
    bundle.sellerId,
    bundle.buyerId,
    bundle.totalCost,       // koper krijgt items + verzendkosten terug
    bundle.totalItemCost,   // alleen item-kosten zaten in escrow
    `Geannuleerd via wederzijds akkoord: bestelling ${bundle.orderNumber}`,
    bundle.id
  );

  // Reset claimsale items naar AVAILABLE (idem als cancelPurchase).
  await prisma.claimsaleItem.updateMany({
    where: { shippingBundleId: bundle.id },
    data: { status: "AVAILABLE", buyerId: null, shippingBundleId: null },
  });

  // Listing-bundle: zet listing terug op ACTIVE als die er nog is.
  if (bundle.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: bundle.listingId } });
    if (listing && listing.status === "SOLD") {
      await prisma.listing.update({
        where: { id: bundle.listingId },
        data: { status: "ACTIVE", buyerId: null },
      });
    }
  }

  // Auction-bundle: status blijft ENDED_SOLD; geen herafleveing mogelijk.
  // Verkoper kan een nieuwe veiling aanmaken als ze het opnieuw willen
  // verkopen.

  await prisma.shippingBundle.update({
    where: { id: bundle.id },
    data: { status: "CANCELLED" },
  });

  await prisma.cancellationRequest.update({
    where: { id: requestId },
    data: {
      status: "ACCEPTED",
      respondedAt: new Date(),
      respondedById: session.user.id,
    },
  });

  await createNotification(
    req.proposedById,
    "NEW_MESSAGE",
    "Annulering geaccepteerd",
    `Bestelling ${bundle.orderNumber} is geannuleerd. Het bedrag (€${bundle.totalCost.toFixed(2)}) is teruggestort.`,
    "/dashboard/aankopen"
  );

  return { success: true, status: "ACCEPTED" };
}

export async function getActiveCancellationRequest(bundleId: string) {
  return prisma.cancellationRequest.findFirst({
    where: { shippingBundleId: bundleId, status: "PENDING" },
    include: {
      proposedBy: { select: { id: true, displayName: true } },
    },
  });
}
