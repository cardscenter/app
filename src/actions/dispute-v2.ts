"use server";

// Dispute v2 — greenfield rewrite (Fase 40).
//
// Naast de bestaande dispute.ts (v1) — lopende v1-cases blijven daar tot ze
// zijn afgerond. Alle NIEUWE disputes gaan via dit bestand. Verschillen:
//   - Structured `reasonCategory` (5 hoofd-redenen + subcategorie) ipv free-text
//   - Expliciete MEDIATION-fase voor proposal-loop
//   - Foto-upload UI bestaat echt (v1 had dead-code params)
//   - 5d admin-SLA-flag bij escalatie
//   - Per-event actorType (BUYER/SELLER/ADMIN/SYSTEM) in timeline
//   - Werkt voor SHIPPED én EXTERNAL-pickup-COMPLETED-bundles
//
// Refund-correctheid:
//   FULL_REFUND   → bundle CANCELLED, escrow + premium terug, listings als
//                   bestaand (claimsale-items naar AVAILABLE, listings naar
//                   ACTIVE) — buyer kreeg toch al z'n geld terug.
//   PARTIAL_REFUND → bundle COMPLETED, refundedAmount += amount.
//   NO_REFUND     → bundle COMPLETED, geen mutaties (escrow gewoon released).
//   RETURN_AND_REFUND → admin-only, behandelt als FULL_REFUND zonder
//                   listings-restore (item terug bij seller).

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import {
  releaseEscrow,
  partialRefundEscrow,
  refundEscrow,
  refundAuctionPremium,
} from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { publish, userChannel } from "@/lib/realtime";
import {
  DISPUTE_V2_OPEN_AFTER_DAYS,
  DISPUTE_V2_WINDOW_DAYS,
  DISPUTE_V2_RESPONSE_DAYS,
  DISPUTE_V2_BUYER_REVIEW_DAYS,
  DISPUTE_V2_ADMIN_SLA_DAYS,
  DISPUTE_V2_REASON_CATEGORIES,
  DISPUTE_V2_RESOLUTIONS,
  type DisputeV2ReasonCategory,
  type DisputeV2Resolution,
} from "@/lib/dispute-v2/config";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function parseEvidenceUrls(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

// ============================================================
// OPEN DISPUTE (buyer)
// ============================================================
export async function openDisputeV2(params: {
  bundleId: string;
  reasonCategory: DisputeV2ReasonCategory;
  reasonSubCategory?: string;
  buyerStatement: string;
  evidenceUrls?: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  if (!DISPUTE_V2_REASON_CATEGORIES.includes(params.reasonCategory)) {
    return { error: "Ongeldige reden-categorie" };
  }
  if (!params.buyerStatement || params.buyerStatement.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens toelichting in zodat we begrijpen wat er aan de hand is." };
  }

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: params.bundleId },
    include: {
      disputeV2: { select: { id: true } },
      dispute: { select: { id: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bundle.disputeV2) return { error: "Er loopt al een geschil voor deze bestelling" };
  if (bundle.dispute) return { error: "Er loopt al een geschil (v1) voor deze bestelling" };

  // Open-window: SHIPPED 10-30d, of EXTERNAL-pickup-COMPLETED ≤ 30d na delivery
  const now = new Date();
  if (bundle.status === "SHIPPED") {
    if (!bundle.shippedAt) {
      return { error: "Bestelling heeft geen verzenddatum — neem contact op met support." };
    }
    const daysSinceShipped = (now.getTime() - bundle.shippedAt.getTime()) / 86_400_000;
    if (daysSinceShipped < DISPUTE_V2_OPEN_AFTER_DAYS) {
      const remaining = Math.ceil(DISPUTE_V2_OPEN_AFTER_DAYS - daysSinceShipped);
      return { error: `Geschil kan pas geopend worden ${remaining} dag(en) na verzending. Voor tracking-problemen vóór die periode: gebruik 'Meld trackingprobleem'.` };
    }
    if (daysSinceShipped > DISPUTE_V2_WINDOW_DAYS) {
      return { error: `Je geschil-window van ${DISPUTE_V2_WINDOW_DAYS} dagen na verzending is verstreken.` };
    }
  } else if (bundle.status === "COMPLETED" && bundle.paymentMode === "EXTERNAL") {
    if (!bundle.deliveredAt) return { error: "Geen leveringsdatum gevonden." };
    const daysSinceDelivered = (now.getTime() - bundle.deliveredAt.getTime()) / 86_400_000;
    if (daysSinceDelivered > DISPUTE_V2_WINDOW_DAYS) {
      return { error: `Je geschil-window van ${DISPUTE_V2_WINDOW_DAYS} dagen na ophalen is verstreken.` };
    }
  } else {
    return { error: "Geschil kan alleen geopend worden op verzonden of opgehaalde bestellingen." };
  }

  const responseDeadline = daysFromNow(DISPUTE_V2_RESPONSE_DAYS);
  const evidence = (params.evidenceUrls ?? []).filter((u) => typeof u === "string");

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.disputeV2.create({
      data: {
        bundleId: bundle.id,
        buyerId: session.user.id,
        sellerId: bundle.sellerId,
        status: "OPEN",
        reasonCategory: params.reasonCategory,
        reasonSubCategory: params.reasonSubCategory ?? null,
        buyerStatement: params.buyerStatement.trim(),
        evidenceBuyer: JSON.stringify(evidence),
        responseDeadline,
      },
    });

    await tx.disputeV2Event.create({
      data: {
        disputeId: created.id,
        type: "OPENED",
        actorId: session.user.id,
        actorType: "BUYER",
        message: `Geschil geopend wegens ${params.reasonCategory.toLowerCase().replace(/_/g, " ")}`,
        metadata: JSON.stringify({ reasonCategory: params.reasonCategory, evidenceCount: evidence.length }),
      },
    });

    // Bundle naar DISPUTED zodat auto-confirm-cron en releaseEscrow het niet aanraken
    await tx.shippingBundle.updateMany({
      where: { id: bundle.id, status: { in: ["SHIPPED", "COMPLETED"] } },
      data: { status: "DISPUTED" },
    });

    return created;
  });

  await createNotification(
    bundle.sellerId,
    "DISPUTE_OPENED",
    "Er is een geschil tegen je geopend",
    `Koper heeft een geschil geopend over bestelling ${bundle.id.slice(0, 8)}. Je hebt ${DISPUTE_V2_RESPONSE_DAYS} dagen om te reageren — anders krijgt de koper automatisch het volledige bedrag terug.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );

  publish(userChannel(bundle.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(bundle.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });

  return { success: true, disputeId: dispute.id };
}

// ============================================================
// RESPOND (seller)
// ============================================================
export async function respondToDisputeV2(params: {
  disputeId: string;
  sellerStatement: string;
  evidenceUrls?: string[];
  proposedRefund?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (!params.sellerStatement || params.sellerStatement.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens toelichting in." };
  }

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: params.disputeId },
    include: { bundle: { select: { totalCost: true, refundedAmount: true } } },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "OPEN") return { error: "Geschil is niet (meer) open voor verkoper-reactie" };

  // Proposed refund: optioneel. Bij geldig getal → MEDIATION, anders SELLER_RESPONDED
  let proposedRefund: number | null = null;
  if (params.proposedRefund !== undefined && params.proposedRefund !== null) {
    if (typeof params.proposedRefund !== "number" || params.proposedRefund < 0) {
      return { error: "Voorgesteld bedrag is ongeldig" };
    }
    const maxRefund = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
    if (params.proposedRefund > maxRefund) {
      return { error: `Maximum refund-bedrag is €${maxRefund.toFixed(2)}` };
    }
    proposedRefund = Math.round(params.proposedRefund * 100) / 100;
  }

  const evidence = (params.evidenceUrls ?? []).filter((u) => typeof u === "string");

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: {
        status: proposedRefund !== null ? "MEDIATION" : "SELLER_RESPONDED",
        sellerStatement: params.sellerStatement.trim(),
        evidenceSeller: JSON.stringify(evidence),
        proposedRefund,
        proposedById: proposedRefund !== null ? session.user.id : null,
        buyerReviewDeadline: daysFromNow(DISPUTE_V2_BUYER_REVIEW_DAYS),
      },
    });

    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: proposedRefund !== null ? "PROPOSAL" : "SELLER_RESPONDED",
        actorId: session.user.id,
        actorType: "SELLER",
        message: proposedRefund !== null ? `Verkoper stelt €${proposedRefund.toFixed(2)} refund voor` : "Verkoper heeft gereageerd",
        metadata: JSON.stringify({ evidenceCount: evidence.length, proposedRefund }),
      },
    });
  });

  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESPONSE",
    proposedRefund !== null ? "Verkoper stelt refund voor" : "Verkoper heeft gereageerd",
    proposedRefund !== null
      ? `Verkoper biedt €${proposedRefund.toFixed(2)} refund aan. Je hebt ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen om te reageren.`
      : `Verkoper heeft gereageerd op het geschil. Je hebt ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen om te reageren.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );

  publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });

  return { success: true };
}

// ============================================================
// PROPOSE REFUND (in MEDIATION fase, andere partij kan tegenvoorstel doen)
// ============================================================
export async function proposeRefundV2(disputeId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (typeof amount !== "number" || amount < 0) return { error: "Bedrag is ongeldig" };

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: { bundle: { select: { totalCost: true, refundedAmount: true } } },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (!["SELLER_RESPONDED", "MEDIATION"].includes(dispute.status)) {
    return { error: "Voorstel kan nu niet gedaan worden in deze fase" };
  }

  const maxRefund = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
  if (amount > maxRefund) return { error: `Maximum refund-bedrag is €${maxRefund.toFixed(2)}` };

  const rounded = Math.round(amount * 100) / 100;

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: {
        status: "MEDIATION",
        proposedRefund: rounded,
        proposedById: session.user.id,
      },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "PROPOSAL",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `${isBuyer ? "Koper" : "Verkoper"} stelt €${rounded.toFixed(2)} refund voor`,
        metadata: JSON.stringify({ proposedRefund: rounded }),
      },
    });
  });

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  publish(userChannel(otherUserId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(session.user.id), { type: "dispute-changed", payload: { disputeId: dispute.id } });

  return { success: true };
}

// ============================================================
// ACCEPT PROPOSAL (andere partij accepteert)
// ============================================================
export async function acceptProposalV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: {
      bundle: {
        select: {
          id: true,
          totalCost: true,
          totalItemCost: true,
          shippingCost: true,
          refundedAmount: true,
          auctionId: true,
          status: true,
        },
      },
    },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "MEDIATION") return { error: "Geen actief voorstel om te accepteren" };
  if (!dispute.proposedRefund || !dispute.proposedById) return { error: "Voorstel ontbreekt" };

  // Andere partij dan de proposer moet accepteren
  if (dispute.proposedById === session.user.id) {
    return { error: "Je kan niet je eigen voorstel accepteren — de andere partij moet reageren." };
  }

  const refundAmount = dispute.proposedRefund;
  const remaining = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
  const releaseAmount = Math.max(0, remaining - refundAmount);

  // Commission-base voor seller-release: alleen items (geen shipping)
  const itemPortion = Math.max(0, dispute.bundle.totalItemCost - (dispute.bundle.refundedAmount ?? 0));
  const commissionableForRelease = Math.min(itemPortion, releaseAmount);

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: {
        status: "RESOLVED_MUTUAL",
        resolution: "PARTIAL_REFUND",
        finalRefund: refundAmount,
        resolvedAt: new Date(),
      },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "PROPOSAL_ACCEPTED",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `Voorstel geaccepteerd: €${refundAmount.toFixed(2)} refund`,
        metadata: JSON.stringify({ refundAmount }),
      },
    });
    await tx.shippingBundle.update({
      where: { id: dispute.bundle.id },
      data: {
        status: "COMPLETED",
        deliveredAt: new Date(),
        refundedAmount: (dispute.bundle.refundedAmount ?? 0) + refundAmount,
      },
    });
  });

  // Refund-mutaties buiten de tx omdat wallet-helpers eigen transacties draaien
  if (refundAmount > 0) {
    await partialRefundEscrow(
      dispute.sellerId,
      dispute.buyerId,
      refundAmount,
      refundAmount,
      `Refund via geschil (mutual): ${dispute.bundle.id.slice(0, 8)}`,
      dispute.bundle.id,
    );
  }
  if (releaseAmount > 0) {
    await releaseEscrow(
      dispute.sellerId,
      releaseAmount,
      `Escrow vrijgegeven na geschil (mutual): ${dispute.bundle.id.slice(0, 8)}`,
      dispute.bundle.id,
      commissionableForRelease,
    );
  }

  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost via mutual akkoord",
    `Het geschil is opgelost. Je hebt €${refundAmount.toFixed(2)} terug ontvangen.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );
  await createNotification(
    dispute.sellerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost via mutual akkoord",
    `Het geschil is opgelost. €${refundAmount.toFixed(2)} is teruggestort naar de koper, het restant is naar je saldo overgeboekt.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );

  publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(dispute.buyerId), { type: "balance-changed", payload: {} });
  publish(userChannel(dispute.sellerId), { type: "balance-changed", payload: {} });

  return { success: true };
}

// ============================================================
// REJECT PROPOSAL (andere partij wijst af → terug naar SELLER_RESPONDED)
// ============================================================
export async function rejectProposalV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "MEDIATION") return { error: "Geen actief voorstel om af te wijzen" };
  if (dispute.proposedById === session.user.id) {
    return { error: "Je kan niet je eigen voorstel afwijzen — trek 'm in via een tegenvoorstel of escalatie." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: {
        status: "SELLER_RESPONDED",
        proposedRefund: null,
        proposedById: null,
      },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "PROPOSAL_REJECTED",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `${isBuyer ? "Koper" : "Verkoper"} heeft voorstel afgewezen`,
      },
    });
  });

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  publish(userChannel(otherUserId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(session.user.id), { type: "dispute-changed", payload: { disputeId: dispute.id } });

  return { success: true };
}

// ============================================================
// REQUEST ESCALATION (beide moeten akkoord → admin)
// ============================================================
export async function requestEscalationV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (!["OPEN", "SELLER_RESPONDED", "MEDIATION"].includes(dispute.status)) {
    return { error: "Escaleren is in deze fase niet mogelijk" };
  }

  // Beide partijen moeten akkoord — escalatie pas effectief wanneer de andere
  // partij ook escaleert. Bewaren we als metadata-event ipv aparte velden,
  // controle via aanwezigheid van events van beide actor-types.
  const existingFromBuyer = await prisma.disputeV2Event.findFirst({
    where: { disputeId, type: "ESCALATION_REQUESTED", actorId: dispute.buyerId },
  });
  const existingFromSeller = await prisma.disputeV2Event.findFirst({
    where: { disputeId, type: "ESCALATION_REQUESTED", actorId: dispute.sellerId },
  });

  const alreadyRequested = isBuyer ? !!existingFromBuyer : !!existingFromSeller;
  if (alreadyRequested) return { error: "Je hebt al om escalatie gevraagd" };

  const otherRequested = isBuyer ? !!existingFromSeller : !!existingFromBuyer;
  const bothAgreed = otherRequested;

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2Event.create({
      data: {
        disputeId,
        type: "ESCALATION_REQUESTED",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `${isBuyer ? "Koper" : "Verkoper"} vraagt om admin-beoordeling`,
      },
    });

    if (bothAgreed) {
      await tx.disputeV2.update({
        where: { id: disputeId },
        data: {
          status: "ESCALATED",
          adminSLADeadline: daysFromNow(DISPUTE_V2_ADMIN_SLA_DAYS),
        },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId,
          type: "ESCALATED",
          actorType: "SYSTEM",
          message: `Beide partijen akkoord — geschil naar admin (SLA ${DISPUTE_V2_ADMIN_SLA_DAYS}d)`,
        },
      });
    }
  });

  publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId } });
  publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId } });

  return { success: true, escalated: bothAgreed };
}

// ============================================================
// ADD EVIDENCE (beide partijen, alle pre-resolved fases)
// ============================================================
export async function addEvidenceV2(params: { disputeId: string; urls: string[] }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const urls = params.urls.filter((u) => typeof u === "string");
  if (urls.length === 0) return { error: "Geen foto's toegevoegd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: params.disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (!["OPEN", "SELLER_RESPONDED", "MEDIATION", "ESCALATED"].includes(dispute.status)) {
    return { error: "Geschil is afgerond — bewijs kan niet meer worden toegevoegd" };
  }

  const existing = isBuyer ? parseEvidenceUrls(dispute.evidenceBuyer) : parseEvidenceUrls(dispute.evidenceSeller);
  const merged = [...existing, ...urls];

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: isBuyer
        ? { evidenceBuyer: JSON.stringify(merged) }
        : { evidenceSeller: JSON.stringify(merged) },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "EVIDENCE_ADDED",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `${urls.length} bewijsfoto('s) toegevoegd`,
        metadata: JSON.stringify({ count: urls.length }),
      },
    });
  });

  return { success: true };
}

// ============================================================
// ADMIN RESOLVE
// ============================================================
export async function adminResolveDisputeV2(params: {
  disputeId: string;
  resolution: DisputeV2Resolution;
  refundAmount?: number;
  adminNotes: string;
}) {
  const { adminId } = await requireAdmin();

  if (!params.adminNotes || params.adminNotes.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens admin-onderbouwing in." };
  }
  if (!DISPUTE_V2_RESOLUTIONS.includes(params.resolution)) {
    return { error: "Ongeldige resolutie" };
  }

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: params.disputeId },
    include: {
      bundle: {
        select: {
          id: true,
          totalCost: true,
          totalItemCost: true,
          shippingCost: true,
          refundedAmount: true,
          auctionId: true,
        },
      },
    },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.status !== "ESCALATED") return { error: "Geschil is niet geëscaleerd" };

  const remaining = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
  if (remaining <= 0) return { error: "Bestelling is al volledig gerefund" };

  let finalRefund = 0;
  let releaseAmount = 0;
  let bundleStatusAfter: "COMPLETED" | "CANCELLED" = "COMPLETED";

  switch (params.resolution) {
    case "FULL_REFUND":
    case "RETURN_AND_REFUND":
      finalRefund = remaining;
      releaseAmount = 0;
      bundleStatusAfter = "CANCELLED";
      break;
    case "NO_REFUND":
      finalRefund = 0;
      releaseAmount = remaining;
      bundleStatusAfter = "COMPLETED";
      break;
    case "PARTIAL_REFUND":
      if (params.refundAmount === undefined || params.refundAmount === null) {
        return { error: "Voor partial refund moet je een bedrag invoeren" };
      }
      if (params.refundAmount <= 0 || params.refundAmount > remaining) {
        return { error: `Refund-bedrag moet tussen €0,01 en €${remaining.toFixed(2)} zijn` };
      }
      finalRefund = Math.round(params.refundAmount * 100) / 100;
      releaseAmount = Math.max(0, remaining - finalRefund);
      bundleStatusAfter = "COMPLETED";
      break;
  }

  // Item-commission base — only over items, not shipping
  const itemPortion = Math.max(0, dispute.bundle.totalItemCost - (dispute.bundle.refundedAmount ?? 0));
  const commissionableForRelease = Math.min(itemPortion, releaseAmount);

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: {
        status: bundleStatusAfter === "CANCELLED" ? "RESOLVED_BUYER" : (finalRefund > 0 ? "RESOLVED_ADMIN" : "RESOLVED_SELLER"),
        resolution: params.resolution,
        finalRefund,
        adminId,
        adminNotes: params.adminNotes.trim(),
        resolvedAt: new Date(),
      },
    });
    await tx.shippingBundle.update({
      where: { id: dispute.bundle.id },
      data: {
        status: bundleStatusAfter,
        deliveredAt: bundleStatusAfter === "COMPLETED" ? new Date() : null,
        refundedAmount: (dispute.bundle.refundedAmount ?? 0) + finalRefund,
      },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "ADMIN_DECISION",
        actorId: adminId,
        actorType: "ADMIN",
        message: `Admin: ${params.resolution} (€${finalRefund.toFixed(2)} refund)`,
        metadata: JSON.stringify({ resolution: params.resolution, finalRefund, releaseAmount }),
      },
    });
  });

  // Refund-mutaties buiten tx
  if (params.resolution === "FULL_REFUND" || params.resolution === "RETURN_AND_REFUND") {
    await refundEscrow(
      dispute.sellerId,
      dispute.buyerId,
      finalRefund,
      finalRefund,
      `Volledige refund via admin-beslissing (geschil ${dispute.id.slice(0, 8)})`,
      dispute.bundle.id,
    );
    if (dispute.bundle.auctionId) {
      await refundAuctionPremium(dispute.buyerId, dispute.bundle.auctionId);
    }
  } else if (params.resolution === "PARTIAL_REFUND") {
    if (finalRefund > 0) {
      await partialRefundEscrow(
        dispute.sellerId,
        dispute.buyerId,
        finalRefund,
        finalRefund,
        `Gedeeltelijke refund via admin-beslissing (geschil ${dispute.id.slice(0, 8)})`,
        dispute.bundle.id,
      );
    }
    if (releaseAmount > 0) {
      await releaseEscrow(
        dispute.sellerId,
        releaseAmount,
        `Escrow vrijgegeven na admin-beslissing (geschil ${dispute.id.slice(0, 8)})`,
        dispute.bundle.id,
        commissionableForRelease,
      );
    }
  } else {
    // NO_REFUND
    if (releaseAmount > 0) {
      await releaseEscrow(
        dispute.sellerId,
        releaseAmount,
        `Escrow vrijgegeven na admin-beslissing (geschil ${dispute.id.slice(0, 8)})`,
        dispute.bundle.id,
        commissionableForRelease,
      );
    }
  }

  await logAdminAction({
    adminId,
    action: "ADMIN_RESOLVE_DISPUTE",
    targetType: "DISPUTE",
    targetId: dispute.id,
    metadata: { version: "v2", resolution: params.resolution, finalRefund, bundleStatusAfter },
  });

  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESOLVED",
    "Geschil is afgerond door admin",
    finalRefund > 0
      ? `Admin heeft besloten: €${finalRefund.toFixed(2)} refund. Zie geschil-detail voor onderbouwing.`
      : "Admin heeft besloten: geen refund. Zie geschil-detail voor onderbouwing.",
    `/dashboard/geschillen-v2/${dispute.id}`,
  );
  await createNotification(
    dispute.sellerId,
    "DISPUTE_RESOLVED",
    "Geschil is afgerond door admin",
    finalRefund > 0
      ? `Admin heeft besloten: €${finalRefund.toFixed(2)} naar koper. Zie geschil-detail voor onderbouwing.`
      : "Admin heeft besloten: geen refund — escrow is naar je saldo overgeboekt.",
    `/dashboard/geschillen-v2/${dispute.id}`,
  );

  publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
  publish(userChannel(dispute.buyerId), { type: "balance-changed", payload: {} });
  publish(userChannel(dispute.sellerId), { type: "balance-changed", payload: {} });

  return { success: true };
}

// ============================================================
// AUTO-RESOLVE (cron-callable)
// ============================================================
export async function autoResolveDisputesV2(): Promise<{ resolved: number }> {
  const now = new Date();
  let resolved = 0;

  // Pad A: OPEN > responseDeadline → seller niet gereageerd → 100% buyer refund
  const openExpired = await prisma.disputeV2.findMany({
    where: { status: "OPEN", responseDeadline: { lt: now } },
    include: {
      bundle: {
        select: {
          id: true,
          totalCost: true,
          totalItemCost: true,
          refundedAmount: true,
          auctionId: true,
        },
      },
    },
  });

  for (const dispute of openExpired) {
    const remaining = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
    if (remaining <= 0) continue;

    await prisma.$transaction(async (tx) => {
      await tx.disputeV2.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED_BUYER",
          resolution: "FULL_REFUND",
          finalRefund: remaining,
          resolvedAt: now,
        },
      });
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: {
          status: "CANCELLED",
          refundedAmount: (dispute.bundle.refundedAmount ?? 0) + remaining,
        },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "AUTO_RESOLVED",
          actorType: "SYSTEM",
          message: `Verkoper heeft niet binnen ${DISPUTE_V2_RESPONSE_DAYS}d gereageerd — volledige refund naar koper`,
        },
      });
    });

    await refundEscrow(
      dispute.sellerId,
      dispute.buyerId,
      remaining,
      remaining,
      `Auto-refund: verkoper niet gereageerd in geschil (${dispute.id.slice(0, 8)})`,
      dispute.bundle.id,
    );
    if (dispute.bundle.auctionId) {
      await refundAuctionPremium(dispute.buyerId, dispute.bundle.auctionId);
    }

    await createNotification(
      dispute.buyerId,
      "DISPUTE_RESOLVED",
      "Geschil afgerond in je voordeel",
      `Verkoper heeft niet binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen gereageerd. Je hebt €${remaining.toFixed(2)} terug.`,
      `/dashboard/geschillen-v2/${dispute.id}`,
    );

    publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
    publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
    publish(userChannel(dispute.buyerId), { type: "balance-changed", payload: {} });

    resolved++;
  }

  // Pad B: SELLER_RESPONDED > buyerReviewDeadline → buyer niet gereageerd → seller wint
  const responseExpired = await prisma.disputeV2.findMany({
    where: { status: "SELLER_RESPONDED", buyerReviewDeadline: { lt: now } },
    include: {
      bundle: {
        select: {
          id: true,
          totalCost: true,
          totalItemCost: true,
          refundedAmount: true,
        },
      },
    },
  });

  for (const dispute of responseExpired) {
    const remaining = dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0);
    const itemPortion = Math.max(0, dispute.bundle.totalItemCost - (dispute.bundle.refundedAmount ?? 0));
    const commissionable = Math.min(itemPortion, remaining);

    await prisma.$transaction(async (tx) => {
      await tx.disputeV2.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED_SELLER",
          resolution: "NO_REFUND",
          finalRefund: 0,
          resolvedAt: now,
        },
      });
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: { status: "COMPLETED", deliveredAt: now },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "AUTO_RESOLVED",
          actorType: "SYSTEM",
          message: `Koper heeft niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS}d gereageerd — geschil gesloten`,
        },
      });
    });

    if (remaining > 0) {
      await releaseEscrow(
        dispute.sellerId,
        remaining,
        `Escrow vrijgegeven na verlopen geschil (${dispute.id.slice(0, 8)})`,
        dispute.bundle.id,
        commissionable,
      );
    }

    await createNotification(
      dispute.sellerId,
      "DISPUTE_RESOLVED",
      "Geschil afgerond in je voordeel",
      `Koper heeft niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen gereageerd. Escrow is naar je saldo overgeboekt.`,
      `/dashboard/geschillen-v2/${dispute.id}`,
    );

    publish(userChannel(dispute.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
    publish(userChannel(dispute.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id } });
    publish(userChannel(dispute.sellerId), { type: "balance-changed", payload: {} });

    resolved++;
  }

  return { resolved };
}
