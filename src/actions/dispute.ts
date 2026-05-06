"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { refundEscrow, releaseEscrow, partialRefundEscrow, refundAuctionPremium } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { logAdminAction } from "@/lib/admin-audit";
import { publish, userChannel } from "@/lib/realtime";

async function logDisputeEvent(disputeId: string, actorId: string, type: string, detail?: string) {
  await prisma.disputeEvent.create({ data: { disputeId, actorId, type, detail } });
}

function publishDisputeChanged(buyerId: string, sellerId: string, disputeId: string, status: string) {
  for (const uid of [buyerId, sellerId]) {
    publish(userChannel(uid), { type: "dispute-changed", payload: { disputeId, status } });
  }
}

const DISPUTE_OPEN_AFTER_DAYS = 10; // Buyer can open dispute 10 days after shipment
const DISPUTE_WINDOW_DAYS = 30; // Must open before auto-confirm (30 days)
const SELLER_RESPONSE_DAYS = 14;
const BUYER_REVIEW_DAYS = 14;

// Buyer opens a dispute on a SHIPPED bundle
export async function openDispute(data: {
  shippingBundleId: string;
  reason: string;
  description: string;
  evidenceUrls?: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: data.shippingBundleId },
    include: {
      seller: { select: { displayName: true } },
      dispute: true,
    },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.status !== "SHIPPED") return { error: "Kan alleen geschil openen voor verzonden bestellingen" };
  if (bundle.dispute) return { error: "DISPUTE_EXISTS" };

  // Block disputes for untracked shipping (briefpost)
  if (bundle.shippingMethodId) {
    const shippingMethod = await prisma.sellerShippingMethod.findUnique({
      where: { id: bundle.shippingMethodId },
      select: { isTracked: true },
    });
    if (shippingMethod && !shippingMethod.isTracked) {
      return { error: "Bij bestellingen via briefpost (zonder tracking) kan geen geschil worden geopend. Dit risico is aangegeven bij het afrekenen." };
    }
  }

  // Check timing: must be 10+ days after shipment
  if (!bundle.shippedAt) return { error: "Verzenddatum onbekend" };
  const daysSinceShipped = (Date.now() - bundle.shippedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceShipped < DISPUTE_OPEN_AFTER_DAYS) {
    return {
      error: "DISPUTE_TOO_EARLY",
      daysRemaining: Math.ceil(DISPUTE_OPEN_AFTER_DAYS - daysSinceShipped),
    };
  }
  if (daysSinceShipped > DISPUTE_WINDOW_DAYS) {
    return { error: "DISPUTE_WINDOW_CLOSED" };
  }

  // Validate reason
  const validReasons = ["NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED_IN_TRANSIT"];
  if (!validReasons.includes(data.reason)) return { error: "Ongeldige reden" };
  if (!data.description || data.description.length < 20) return { error: "Beschrijving moet minimaal 20 tekens zijn" };

  const responseDeadline = new Date(Date.now() + SELLER_RESPONSE_DAYS * 24 * 60 * 60 * 1000);

  const dispute = await prisma.dispute.create({
    data: {
      shippingBundleId: data.shippingBundleId,
      openedById: session.user.id,
      reason: data.reason,
      description: data.description,
      evidenceUrls: JSON.stringify(data.evidenceUrls ?? []),
      responseDeadline,
    },
  });

  await logDisputeEvent(dispute.id, session.user.id, "OPENED", data.reason);

  // Update bundle status
  await prisma.shippingBundle.update({
    where: { id: data.shippingBundleId },
    data: { status: "DISPUTED" },
  });

  // Notify seller
  await createNotification(
    bundle.sellerId,
    "DISPUTE_OPENED",
    "Geschil geopend",
    `Een koper heeft een geschil geopend voor een bestelling. Je hebt 7 dagen om te reageren.`,
    `/dashboard/geschillen/${dispute.id}`
  );

  publishDisputeChanged(bundle.buyerId, bundle.sellerId, dispute.id, "OPEN");

  revalidatePath(`/dashboard/geschillen/${dispute.id}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true, disputeId: dispute.id };
}

// Seller responds to a dispute
export async function respondToDispute(data: {
  disputeId: string;
  sellerResponse: string;
  sellerEvidenceUrls?: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: data.disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.shippingBundle.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "OPEN") return { error: "Kan alleen reageren op open geschillen" };
  if (!data.sellerResponse || data.sellerResponse.length < 20) return { error: "Reactie moet minimaal 20 tekens zijn" };

  const buyerReviewDeadline = new Date(Date.now() + BUYER_REVIEW_DAYS * 24 * 60 * 60 * 1000);

  await prisma.dispute.update({
    where: { id: data.disputeId },
    data: {
      sellerResponse: data.sellerResponse,
      sellerEvidenceUrls: JSON.stringify(data.sellerEvidenceUrls ?? []),
      sellerRespondedAt: new Date(),
      status: "SELLER_RESPONDED",
      buyerReviewDeadline,
    },
  });

  await logDisputeEvent(data.disputeId, session.user.id, "SELLER_RESPONDED");

  // Notify buyer
  await createNotification(
    dispute.openedById,
    "DISPUTE_RESPONDED",
    "Verkoper heeft gereageerd",
    "De verkoper heeft gereageerd op je geschil. Bekijk de reactie en neem actie.",
    `/dashboard/geschillen/${dispute.id}`
  );

  publishDisputeChanged(dispute.shippingBundle.buyerId, dispute.shippingBundle.sellerId, dispute.id, "SELLER_RESPONDED");

  revalidatePath(`/dashboard/geschillen/${data.disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Buyer accepts seller's response (no refund, dispute closes)
export async function acceptSellerResponse(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.openedById !== session.user.id) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "SELLER_RESPONDED") return { error: "Verkoper heeft nog niet gereageerd" };

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "RESOLVED_SELLER",
      resolution: "NO_REFUND",
      resolvedAt: new Date(),
    },
  });

  await logDisputeEvent(disputeId, session.user.id, "RESOLVED", "NO_REFUND");

  // Bundle goes back to SHIPPED
  await prisma.shippingBundle.update({
    where: { id: dispute.shippingBundleId },
    data: { status: "SHIPPED" },
  });

  // Notify seller
  await createNotification(
    dispute.shippingBundle.sellerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost",
    "De koper heeft je reactie geaccepteerd. Het geschil is gesloten.",
    `/dashboard/geschillen/${disputeId}`
  );

  publishDisputeChanged(dispute.shippingBundle.buyerId, dispute.shippingBundle.sellerId, disputeId, "RESOLVED_SELLER");

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Buyer rejects seller response → direct escalation to admin
export async function rejectAndResolve(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.openedById !== session.user.id) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "SELLER_RESPONDED") return { error: "Verkoper heeft nog niet gereageerd" };

  const bundle = dispute.shippingBundle;

  // Direct escalation — no need for seller agreement since buyer already
  // had the chance to accept the response or propose a settlement
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "ESCALATED",
      buyerAcceptsEscalation: true,
      sellerAcceptsEscalation: true,
    },
  });

  await logDisputeEvent(disputeId, session.user.id, "REJECTED_TO_ADMIN");
  await logDisputeEvent(disputeId, session.user.id, "ESCALATED");

  // Notify both parties
  const notifyText = "Het geschil is doorgestuurd naar een beheerder voor beoordeling.";
  await createNotification(bundle.buyerId, "DISPUTE_ESCALATED", "Geschil geëscaleerd", notifyText, `/dashboard/geschillen/${disputeId}`);
  await createNotification(bundle.sellerId, "DISPUTE_ESCALATED", "Geschil geëscaleerd", notifyText, `/dashboard/geschillen/${disputeId}`);

  publishDisputeChanged(bundle.buyerId, bundle.sellerId, disputeId, "ESCALATED");

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Either party proposes a mutual partial refund
export async function proposeMutualResolution(disputeId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };

  const bundle = dispute.shippingBundle;
  const isBuyer = dispute.openedById === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (dispute.status !== "OPEN" && dispute.status !== "SELLER_RESPONDED") {
    return { error: "Geschil is al opgelost" };
  }

  // Block if escalation is already requested
  if (dispute.buyerAcceptsEscalation || dispute.sellerAcceptsEscalation) {
    return { error: "Escalatie is al aangevraagd. Je kunt geen schikkingsvoorstel meer doen." };
  }

  if (amount <= 0 || amount > bundle.totalItemCost) {
    return { error: "Ongeldig bedrag" };
  }

  // Store proposed amount and who proposed it
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      partialRefundAmount: amount,
      proposedById: session.user.id,
    },
  });

  await logDisputeEvent(disputeId, session.user.id, "PROPOSAL_MADE", `€${amount.toFixed(2)}`);

  // Notify the other party
  const notifyUserId = isBuyer ? bundle.sellerId : bundle.buyerId;
  await createNotification(
    notifyUserId,
    "DISPUTE_PROPOSAL",
    "Schikkingsvoorstel ontvangen",
    `Er is een gedeeltelijke terugbetaling van €${amount.toFixed(2)} voorgesteld.`,
    `/dashboard/geschillen/${disputeId}`
  );

  publishDisputeChanged(bundle.buyerId, bundle.sellerId, disputeId, dispute.status);

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Accept a mutual resolution proposal
export async function acceptMutualResolution(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (!dispute.partialRefundAmount || !dispute.proposedById) return { error: "Geen voorstel om te accepteren" };

  const bundle = dispute.shippingBundle;
  const isBuyer = dispute.openedById === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  // Only the OTHER party can accept (not the person who proposed)
  if (dispute.proposedById === session.user.id) {
    return { error: "Je kunt je eigen voorstel niet accepteren" };
  }

  const refundAmount = dispute.partialRefundAmount;

  await logDisputeEvent(disputeId, session.user.id, "PROPOSAL_ACCEPTED", `€${refundAmount.toFixed(2)}`);

  // Process partial refund — heldBalance bevat sinds Fase 28 ook shipping,
  // dus escrow-decrement = refund-bedrag direct.
  await partialRefundEscrow(
    bundle.sellerId,
    bundle.buyerId,
    refundAmount,
    refundAmount,
    `Geschil onderling opgelost: €${refundAmount.toFixed(2)} terugbetaald`,
    bundle.id,
  );

  // Release remaining escrow to seller — refund-aware. Total al in escrow,
  // dus releaseAmount = totalCost − (alle refunds incl deze partial).
  const totalRefundedAfter = bundle.refundedAmount + refundAmount;
  const remainingEscrow = Math.max(0, bundle.totalCost - totalRefundedAfter);
  if (remainingEscrow > 0) {
    const commissionableRemaining = Math.max(0, bundle.totalItemCost - totalRefundedAfter);
    await releaseEscrow(
      bundle.sellerId,
      remainingEscrow,
      `Geschil opgelost: resterend bedrag vrijgegeven`,
      bundle.id,
      commissionableRemaining,
    );
  }

  await prisma.shippingBundle.update({
    where: { id: bundle.id },
    data: { status: "COMPLETED", deliveredAt: new Date() },
  });

  await finalizeDispute(disputeId, bundle.id, "RESOLVED_MUTUAL", "MUTUAL_AGREEMENT", bundle.sellerId, bundle.buyerId, refundAmount);

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Auto-resolve disputes (called by cron)
export async function autoResolveDisputes() {
  const now = new Date();
  let resolved = 0;

  // 1. Seller never responded (deadline passed)
  const expiredOpen = await prisma.dispute.findMany({
    where: {
      status: "OPEN",
      responseDeadline: { lte: now },
    },
    include: {
      shippingBundle: {
        include: { seller: { select: { displayName: true } } },
      },
    },
  });

  for (const dispute of expiredOpen) {
    const bundle = dispute.shippingBundle;
    // Seller did not respond within deadline → buyer wins. Hele resterende
    // escrow gaat terug naar koper (totalCost incl shipping zit in heldBalance).
    const refundAmount = Math.max(0, bundle.totalCost - bundle.refundedAmount);
    await refundEscrow(
      bundle.sellerId,
      bundle.buyerId,
      refundAmount,
      refundAmount,
      `Geschil auto-opgelost: verkoper heeft niet gereageerd binnen ${SELLER_RESPONSE_DAYS} dagen`,
      bundle.id,
    );
    // Auction-bundles: buyer's premium ook terugbetalen (Fase 31).
    if (bundle.auctionId) {
      await refundAuctionPremium(bundle.buyerId, bundle.auctionId);
    }
    await finalizeDispute(dispute.id, bundle.id, "RESOLVED_BUYER", "REFUND_FULL", bundle.sellerId, bundle.buyerId);
    resolved++;
  }

  // 2. Buyer never acted after seller responded (deadline passed)
  const expiredResponded = await prisma.dispute.findMany({
    where: {
      status: "SELLER_RESPONDED",
      buyerReviewDeadline: { lte: now },
    },
    include: { shippingBundle: true },
  });

  for (const dispute of expiredResponded) {
    const bundle = dispute.shippingBundle;
    // Buyer inaction → seller wins, bundle back to SHIPPED
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: { status: "SHIPPED" },
    });
    await finalizeDispute(dispute.id, bundle.id, "RESOLVED_SELLER", "NO_REFUND", bundle.sellerId, bundle.buyerId);
    resolved++;
  }

  return { resolved };
}

// Either party requests escalation to admin
export async function requestEscalation(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };

  const bundle = dispute.shippingBundle;
  const isBuyer = dispute.openedById === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (dispute.status !== "OPEN" && dispute.status !== "SELLER_RESPONDED") {
    return { error: "Geschil kan niet meer geëscaleerd worden" };
  }

  // Block if there's a pending settlement proposal
  if (dispute.partialRefundAmount !== null && dispute.proposedById !== null) {
    return { error: "Er staat nog een schikkingsvoorstel open. Trek dit eerst in." };
  }

  const updateData: Record<string, boolean> = {};
  if (isBuyer) updateData.buyerAcceptsEscalation = true;
  if (isSeller) updateData.sellerAcceptsEscalation = true;

  await prisma.dispute.update({
    where: { id: disputeId },
    data: updateData,
  });

  await logDisputeEvent(disputeId, session.user.id, "ESCALATION_REQUESTED");

  // Check if both parties now agree
  const updated = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (updated?.buyerAcceptsEscalation && updated?.sellerAcceptsEscalation) {
    await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: "ESCALATED" },
    });

    await logDisputeEvent(disputeId, session.user.id, "ESCALATED");

    // Notify both
    const notifyText = "Het geschil is doorgestuurd naar een beheerder voor beoordeling.";
    await createNotification(bundle.buyerId, "DISPUTE_ESCALATED", "Geschil geëscaleerd", notifyText, `/dashboard/geschillen/${disputeId}`);
    await createNotification(bundle.sellerId, "DISPUTE_ESCALATED", "Geschil geëscaleerd", notifyText, `/dashboard/geschillen/${disputeId}`);
  } else {
    // Notify the other party that escalation was requested
    const notifyUserId = isBuyer ? bundle.sellerId : bundle.buyerId;
    await createNotification(
      notifyUserId,
      "DISPUTE_ESCALATION_REQUESTED",
      "Escalatie aangevraagd",
      "De andere partij wil het geschil doorsturen naar een beheerder. Geef je akkoord als je het hiermee eens bent.",
      `/dashboard/geschillen/${disputeId}`
    );
  }

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Admin resolves an escalated dispute
export async function adminResolveDispute(data: {
  disputeId: string;
  decision: "BUYER" | "SELLER" | "PARTIAL";
  partialAmount?: number;
  adminNotes: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  // Check admin role
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (admin?.accountType !== "ADMIN") return { error: "Geen beheerder" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: data.disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.status !== "ESCALATED") return { error: "Geschil is niet geëscaleerd" };

  const bundle = dispute.shippingBundle;

  if (data.decision === "BUYER") {
    // Full refund to buyer — resterende escrow (na eventuele eerdere partials).
    const refundAmount = Math.max(0, bundle.totalCost - bundle.refundedAmount);
    await refundEscrow(
      bundle.sellerId,
      bundle.buyerId,
      refundAmount,
      refundAmount,
      `Beheerder: volledige terugbetaling aan koper`,
      bundle.id,
    );
    // Auction-bundles: buyer's premium ook terugbetalen bij admin-BUYER
    // beslissing (volledige refund = bundle gaat niet door, Fase 31).
    if (bundle.auctionId) {
      await refundAuctionPremium(bundle.buyerId, bundle.auctionId);
    }
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: { status: "CANCELLED" },
    });
    await prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        status: "RESOLVED_BUYER",
        resolution: "ADMIN_DECISION",
        resolvedAt: new Date(),
        resolvedById: session.user.id,
        adminNotes: data.adminNotes,
      },
    });
  } else if (data.decision === "SELLER") {
    // No refund, release resterende escrow aan seller. Commissie alleen over items.
    const releaseAmount = Math.max(0, bundle.totalCost - bundle.refundedAmount);
    const commissionableAmount = Math.max(0, bundle.totalItemCost - bundle.refundedAmount);
    await releaseEscrow(
      bundle.sellerId,
      releaseAmount,
      `Beheerder: geen terugbetaling, bedrag vrijgegeven`,
      bundle.id,
      commissionableAmount,
    );
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });
    await prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        status: "RESOLVED_SELLER",
        resolution: "ADMIN_DECISION",
        resolvedAt: new Date(),
        resolvedById: session.user.id,
        adminNotes: data.adminNotes,
      },
    });
  } else if (data.decision === "PARTIAL" && data.partialAmount) {
    // Partial refund — heldBalance bevat totalCost; refund-decrement = bedrag.
    await partialRefundEscrow(
      bundle.sellerId,
      bundle.buyerId,
      data.partialAmount,
      data.partialAmount,
      `Beheerder: gedeeltelijke terugbetaling €${data.partialAmount.toFixed(2)}`,
      bundle.id,
    );
    // Release resterende escrow aan seller. Commissie alleen over items.
    const totalRefundedAfter = bundle.refundedAmount + data.partialAmount;
    const remaining = Math.max(0, bundle.totalCost - totalRefundedAfter);
    const commissionableRemaining = Math.max(0, bundle.totalItemCost - totalRefundedAfter);
    if (remaining > 0) {
      await releaseEscrow(
        bundle.sellerId,
        remaining,
        `Beheerder: resterend bedrag vrijgegeven`,
        bundle.id,
        commissionableRemaining,
      );
    }
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });
    await prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        status: "RESOLVED_MUTUAL",
        resolution: "ADMIN_DECISION",
        partialRefundAmount: data.partialAmount,
        resolvedAt: new Date(),
        resolvedById: session.user.id,
        adminNotes: data.adminNotes,
      },
    });
  }

  await logDisputeEvent(data.disputeId, session.user.id, "RESOLVED", `ADMIN_${data.decision}${data.partialAmount ? ` €${data.partialAmount.toFixed(2)}` : ""}`);

  // Notify both parties
  const resolutionText = data.decision === "BUYER"
    ? "Een beheerder heeft beslist: volledige terugbetaling aan de koper."
    : data.decision === "SELLER"
      ? "Een beheerder heeft beslist: geen terugbetaling."
      : `Een beheerder heeft beslist: gedeeltelijke terugbetaling van €${data.partialAmount?.toFixed(2)}.`;

  await createNotification(bundle.buyerId, "DISPUTE_RESOLVED", "Beheerder heeft beslist", resolutionText, `/dashboard/geschillen/${data.disputeId}`);
  await createNotification(bundle.sellerId, "DISPUTE_RESOLVED", "Beheerder heeft beslist", resolutionText, `/dashboard/geschillen/${data.disputeId}`);

  await logAdminAction({
    adminId: session.user.id,
    action: "ADMIN_RESOLVE_DISPUTE",
    targetType: "DISPUTE",
    targetId: data.disputeId,
    metadata: {
      decision: data.decision,
      partialAmount: data.partialAmount ?? null,
      adminNotes: data.adminNotes,
      buyerId: bundle.buyerId,
      sellerId: bundle.sellerId,
      bundleId: bundle.id,
    },
  });

  revalidatePath(`/dashboard/geschillen/${data.disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}

// Helper: finalize dispute and send notifications
async function finalizeDispute(
  disputeId: string,
  bundleId: string,
  status: string,
  resolution: string,
  sellerId: string,
  buyerId: string,
  partialAmount?: number
) {
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      resolution,
      resolvedAt: new Date(),
      ...(partialAmount !== undefined ? { partialRefundAmount: partialAmount } : {}),
    },
  });

  // Log RESOLVED event — use the winning party as actor for auto-resolved disputes
  const actorId = status === "RESOLVED_BUYER" ? buyerId : sellerId;
  await logDisputeEvent(disputeId, actorId, "RESOLVED", resolution);

  const buyerText = resolution === "REFUND_FULL"
    ? "Je ontvangt een volledige terugbetaling."
    : resolution === "REFUND_PARTIAL"
      ? `Je ontvangt €${partialAmount?.toFixed(2)} terugbetaald.`
      : resolution === "MUTUAL_AGREEMENT"
        ? `Onderling opgelost: €${partialAmount?.toFixed(2)} wordt aan je terugbetaald.`
        : "Het geschil is gesloten zonder terugbetaling.";

  const sellerText = resolution === "REFUND_FULL"
    ? "Het volledige bedrag is terugbetaald aan de koper."
    : resolution === "REFUND_PARTIAL"
      ? `€${partialAmount?.toFixed(2)} is terugbetaald aan de koper.`
      : resolution === "MUTUAL_AGREEMENT"
        ? `Onderling opgelost: €${partialAmount?.toFixed(2)} terugbetaald aan de koper.`
        : "Het geschil is gesloten in jouw voordeel.";

  await createNotification(
    buyerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost",
    buyerText,
    `/dashboard/geschillen/${disputeId}`
  );

  await createNotification(
    sellerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost",
    sellerText,
    `/dashboard/geschillen/${disputeId}`
  );

  // Real-time dispute-changed + bundle-changed (resolution flipt bundle naar
  // COMPLETED/SHIPPED). Beide partijen ontvangen via user-channel (Fase 30C).
  publishDisputeChanged(buyerId, sellerId, disputeId, status);
  for (const uid of [buyerId, sellerId]) {
    publish(userChannel(uid), { type: "bundle-changed", payload: { bundleId, status: "DISPUTE_RESOLVED" } });
  }
}

// Withdraw own settlement proposal
export async function withdrawProposal(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { shippingBundle: true },
  });

  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.proposedById !== session.user.id) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "OPEN" && dispute.status !== "SELLER_RESPONDED") {
    return { error: "Geschil is al opgelost" };
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      partialRefundAmount: null,
      proposedById: null,
    },
  });

  await logDisputeEvent(disputeId, session.user.id, "PROPOSAL_WITHDRAWN");

  revalidatePath(`/dashboard/geschillen/${disputeId}`);
  revalidatePath("/dashboard/geschillen");
  return { success: true };
}
