"use server";

// ShippingIssue — lightweight admin-tickets voor tracking-problemen (Fase 40).
//
// Voor scenario's waar de zware DisputeV2-flow disproportioneel zou zijn:
//   - tracking blijft hangen op "in transit" > 14 dagen
//   - geen scan-update meer
//   - pakket bij verkeerd adres bezorgd
//
// Buyer kan na 14d sinds shipped een ticket openen. Admin onderzoekt en
// resolved met RESOLVED_GOODWILL (platform credit tot €50, Transaction
// GOODWILL_REFUND), RESOLVED_NO_ACTION (ticket dicht) of ESCALATED_TO_DISPUTE
// (auto-create DisputeV2 met NOT_RECEIVED + admin-notitie).
//
// Tijdens OPEN/INVESTIGATING skipt auto-confirm-cron deze bundle.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { requireNotSuspended } from "@/lib/suspension";
import { createNotification } from "@/actions/notification";
import { publish, userChannel } from "@/lib/realtime";
import { creditBalance } from "@/actions/wallet";
import { SHIPPING_ISSUE_TYPES, GOODWILL_REFUND_MAX } from "@/lib/shipping-issue/config";

export async function openShippingIssue(params: {
  bundleId: string;
  type: (typeof SHIPPING_ISSUE_TYPES)[number];
  description: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  if (!SHIPPING_ISSUE_TYPES.includes(params.type)) {
    return { error: "Ongeldig type" };
  }
  if (!params.description || params.description.trim().length < 20) {
    return { error: "Beschrijf het probleem in minimaal 20 tekens." };
  }

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: params.bundleId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      status: true,
      shippedAt: true,
      disputeV2: { select: { id: true } },
      dispute: { select: { id: true } },
      shippingIssues: { where: { status: { in: ["OPEN", "INVESTIGATING"] } }, select: { id: true } },
    },
  });
  if (!bundle) return { error: "Bestelling niet gevonden" };

  // Toegang: buyer altijd, seller alleen bij WRONG_DELIVERY
  const isBuyer = bundle.buyerId === session.user.id;
  const isSeller = bundle.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (isSeller && params.type !== "WRONG_DELIVERY") {
    return { error: "Verkopers kunnen alleen WRONG_DELIVERY-tickets openen" };
  }

  // Open-window: SHIPPED + ≥14d sinds verzending (voor buyer); seller mag
  // altijd voor WRONG_DELIVERY (bv. buyer geeft door dat pakket bij buurman ligt).
  if (isBuyer) {
    if (bundle.status !== "SHIPPED") {
      return { error: "Trackingproblemen kunnen alleen op verzonden bestellingen gemeld worden." };
    }
    if (!bundle.shippedAt) return { error: "Bestelling heeft geen verzenddatum." };
    const daysSinceShipped = (Date.now() - bundle.shippedAt.getTime()) / 86_400_000;
    if (daysSinceShipped < 14) {
      const remaining = Math.ceil(14 - daysSinceShipped);
      return { error: `Wacht nog ${remaining} dagen voor je een trackingprobleem meldt — tracking-updates kunnen vertraging hebben.` };
    }
  }

  if (bundle.dispute || bundle.disputeV2) {
    return { error: "Er loopt al een geschil voor deze bestelling — geen aparte ticket nodig." };
  }
  if (bundle.shippingIssues.length > 0) {
    return { error: "Er staat al een trackingticket open voor deze bestelling." };
  }

  const issue = await prisma.shippingIssue.create({
    data: {
      bundleId: bundle.id,
      reporterId: session.user.id,
      type: params.type,
      description: params.description.trim(),
      status: "OPEN",
    },
  });

  // Notify admin — gebruik bestaande pattern: alle ADMINs krijgen een ping.
  const admins = await prisma.user.findMany({
    where: { accountType: "ADMIN" },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "ADMIN_TASK",
      "Nieuw trackingticket",
      `${isBuyer ? "Koper" : "Verkoper"} meldt tracking-probleem (${params.type}). Bundle ${bundle.id.slice(0, 8)}.`,
      `/dashboard/admin/shipping-issues`,
    );
  }

  // Notify counterparty (informational — geen actie van ze nodig)
  const otherUserId = isBuyer ? bundle.sellerId : bundle.buyerId;
  await createNotification(
    otherUserId,
    "ORDER_SHIPPED",
    "Wederpartij meldt tracking-probleem",
    `${isBuyer ? "Koper" : "Verkoper"} heeft een trackingticket geopend voor bestelling ${bundle.id.slice(0, 8)}. Admin onderzoekt; je hoeft nu niks te doen.`,
    "/dashboard/aankopen",
  );

  publish(userChannel(bundle.buyerId), { type: "bundle-changed", payload: { bundleId: bundle.id, status: bundle.status } });
  publish(userChannel(bundle.sellerId), { type: "bundle-changed", payload: { bundleId: bundle.id, status: bundle.status } });

  return { success: true, issueId: issue.id };
}

// ============================================================
// ADMIN — start onderzoek (markeer als INVESTIGATING)
// ============================================================
export async function startInvestigatingShippingIssue(issueId: string) {
  const { adminId } = await requireAdmin();

  const issue = await prisma.shippingIssue.findUnique({ where: { id: issueId } });
  if (!issue) return { error: "Ticket niet gevonden" };
  if (issue.status !== "OPEN") return { error: "Ticket is niet in OPEN-status" };

  await prisma.shippingIssue.update({
    where: { id: issueId },
    data: { status: "INVESTIGATING", adminId },
  });

  return { success: true };
}

// ============================================================
// ADMIN — resolve met goodwill-credit (platform betaalt buyer)
// ============================================================
export async function resolveShippingIssueGoodwill(params: {
  issueId: string;
  amount: number;
  resolution: string;
}) {
  const { adminId } = await requireAdmin();

  if (typeof params.amount !== "number" || params.amount <= 0) {
    return { error: "Bedrag moet positief zijn" };
  }
  if (params.amount > GOODWILL_REFUND_MAX) {
    return { error: `Goodwill-refund is gemaximeerd op €${GOODWILL_REFUND_MAX.toFixed(2)}. Voor hogere bedragen: escaleer naar DisputeV2.` };
  }
  if (!params.resolution || params.resolution.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens onderbouwing in." };
  }

  const issue = await prisma.shippingIssue.findUnique({
    where: { id: params.issueId },
    include: { bundle: { select: { id: true, buyerId: true, sellerId: true, status: true } } },
  });
  if (!issue) return { error: "Ticket niet gevonden" };
  if (!["OPEN", "INVESTIGATING"].includes(issue.status)) {
    return { error: "Ticket is al afgerond" };
  }

  // Platform betaalt buyer (geen escrow-mutatie — bundle blijft SHIPPED).
  // Transaction-rij wordt aangemaakt door creditBalance; we hoeven die id
  // niet apart op de ShippingIssue te bewaren — de Transaction.description
  // bevat al de ticket-referentie en is via userId+type=GOODWILL_REFUND
  // doorzoekbaar.
  await creditBalance(
    issue.bundle.buyerId,
    params.amount,
    "GOODWILL_REFUND",
    `Goodwill-vergoeding tracking-probleem (ticket ${issue.id.slice(0, 8)})`,
  );

  await prisma.shippingIssue.update({
    where: { id: issue.id },
    data: {
      status: "RESOLVED_GOODWILL",
      adminId,
      resolution: params.resolution.trim(),
      resolvedAt: new Date(),
    },
  });

  await logAdminAction({
    adminId,
    action: "RESOLVE_SHIPPING_ISSUE",
    targetType: "SHIPPING_ISSUE",
    targetId: issue.id,
    metadata: { type: "GOODWILL", amount: params.amount },
  });

  await createNotification(
    issue.bundle.buyerId,
    "DISPUTE_RESOLVED",
    "Trackingticket: goodwill-vergoeding",
    `Het platform heeft je €${params.amount.toFixed(2)} goodwill-vergoeding toegekend voor je trackingprobleem. Bekijk de details in je trackingtickets.`,
    "/dashboard/aankopen",
  );
  await createNotification(
    issue.bundle.sellerId,
    "DISPUTE_RESOLVED",
    "Trackingticket afgerond",
    `De goodwill-vergoeding van €${params.amount.toFixed(2)} is door het platform betaald — niet uit jouw escrow. Je bestelling blijft op SHIPPED-status.`,
    "/dashboard/verkopen",
  );

  publish(userChannel(issue.bundle.buyerId), { type: "balance-changed", payload: {} });
  publish(userChannel(issue.bundle.buyerId), { type: "bundle-changed", payload: { bundleId: issue.bundle.id, status: issue.bundle.status } });
  publish(userChannel(issue.bundle.sellerId), { type: "bundle-changed", payload: { bundleId: issue.bundle.id, status: issue.bundle.status } });

  return { success: true };
}

// ============================================================
// ADMIN — resolve zonder actie (afsluiten)
// ============================================================
export async function resolveShippingIssueNoAction(params: {
  issueId: string;
  resolution: string;
}) {
  const { adminId } = await requireAdmin();

  if (!params.resolution || params.resolution.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens onderbouwing in." };
  }

  const issue = await prisma.shippingIssue.findUnique({
    where: { id: params.issueId },
    include: { bundle: { select: { id: true, buyerId: true, sellerId: true, status: true } } },
  });
  if (!issue) return { error: "Ticket niet gevonden" };
  if (!["OPEN", "INVESTIGATING"].includes(issue.status)) {
    return { error: "Ticket is al afgerond" };
  }

  await prisma.shippingIssue.update({
    where: { id: issue.id },
    data: {
      status: "RESOLVED_NO_ACTION",
      adminId,
      resolution: params.resolution.trim(),
      resolvedAt: new Date(),
    },
  });

  await logAdminAction({
    adminId,
    action: "RESOLVE_SHIPPING_ISSUE",
    targetType: "SHIPPING_ISSUE",
    targetId: issue.id,
    metadata: { type: "NO_ACTION" },
  });

  await createNotification(
    issue.reporterId,
    "DISPUTE_RESOLVED",
    "Trackingticket afgesloten",
    `Het ticket is afgesloten zonder actie. Bekijk de onderbouwing in /dashboard/aankopen. Mocht je het oneens zijn, open dan een geschil.`,
    "/dashboard/aankopen",
  );

  publish(userChannel(issue.bundle.buyerId), { type: "bundle-changed", payload: { bundleId: issue.bundle.id, status: issue.bundle.status } });
  publish(userChannel(issue.bundle.sellerId), { type: "bundle-changed", payload: { bundleId: issue.bundle.id, status: issue.bundle.status } });

  return { success: true };
}

// ============================================================
// ADMIN — escaleer naar DisputeV2 (creëer dispute namens buyer)
// ============================================================
export async function escalateShippingIssueToDispute(params: {
  issueId: string;
  adminStatement: string;
}) {
  const { adminId } = await requireAdmin();

  if (!params.adminStatement || params.adminStatement.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens onderbouwing in." };
  }

  const issue = await prisma.shippingIssue.findUnique({
    where: { id: params.issueId },
    include: {
      bundle: {
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
          disputeV2: { select: { id: true } },
        },
      },
    },
  });
  if (!issue) return { error: "Ticket niet gevonden" };
  if (!["OPEN", "INVESTIGATING"].includes(issue.status)) {
    return { error: "Ticket is al afgerond" };
  }
  if (issue.bundle.disputeV2) return { error: "Er loopt al een geschil voor deze bestelling" };

  // Maak DisputeV2 met admin-statement, link beide kanten
  const responseDeadline = new Date();
  responseDeadline.setDate(responseDeadline.getDate() + 14);

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.disputeV2.create({
      data: {
        bundleId: issue.bundle.id,
        buyerId: issue.bundle.buyerId,
        sellerId: issue.bundle.sellerId,
        status: "OPEN",
        reasonCategory: "NOT_RECEIVED",
        reasonSubCategory: `escalated_from_shipping_issue_${issue.type.toLowerCase()}`,
        buyerStatement: `${issue.description}\n\n[Admin-escalatie van trackingticket: ${params.adminStatement.trim()}]`,
        evidenceBuyer: "[]",
        evidenceSeller: "[]",
        responseDeadline,
        escalatedFromShippingIssueId: issue.id,
      },
    });

    await tx.disputeV2Event.create({
      data: {
        disputeId: created.id,
        type: "OPENED",
        actorId: adminId,
        actorType: "ADMIN",
        message: `Geschil aangemaakt door admin via escalatie van trackingticket ${issue.id.slice(0, 8)}`,
      },
    });

    await tx.shippingBundle.updateMany({
      where: { id: issue.bundle.id, status: { in: ["SHIPPED", "COMPLETED"] } },
      data: { status: "DISPUTED" },
    });

    await tx.shippingIssue.update({
      where: { id: issue.id },
      data: {
        status: "ESCALATED_TO_DISPUTE",
        adminId,
        resolution: params.adminStatement.trim(),
        resolvedAt: new Date(),
      },
    });

    return created;
  });

  await logAdminAction({
    adminId,
    action: "RESOLVE_SHIPPING_ISSUE",
    targetType: "SHIPPING_ISSUE",
    targetId: issue.id,
    metadata: { type: "ESCALATED_TO_DISPUTE", disputeId: dispute.id },
  });

  await createNotification(
    issue.bundle.sellerId,
    "DISPUTE_OPENED",
    "Trackingticket geëscaleerd naar geschil",
    `Admin heeft je trackingticket geëscaleerd naar een geschil. Je hebt 14 dagen om te reageren.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );
  await createNotification(
    issue.bundle.buyerId,
    "DISPUTE_OPENED",
    "Trackingticket geëscaleerd naar geschil",
    `Je trackingticket is omgezet naar een geschil. De verkoper heeft 14 dagen om te reageren.`,
    `/dashboard/geschillen-v2/${dispute.id}`,
  );

  publish(userChannel(issue.bundle.buyerId), { type: "dispute-changed", payload: { disputeId: dispute.id, status: dispute.status } });
  publish(userChannel(issue.bundle.sellerId), { type: "dispute-changed", payload: { disputeId: dispute.id, status: dispute.status } });

  return { success: true, disputeId: dispute.id };
}
