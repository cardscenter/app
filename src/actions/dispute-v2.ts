"use server";

// Geschillen — het enige geschil-systeem (sinds 2026-09-08; v1 is verwijderd,
// de naam "V2" in model/bestand is historisch).
//
// Flow (DisputeV2.status):
//   OPEN             koper opende; verkoper heeft RESPONSE_DAYS om te reageren
//   SELLER_RESPONDED verkoper reageerde; wederpartij heeft BUYER_REVIEW_DAYS
//   MEDIATION        er staat een refund-voorstel uit; wederpartij heeft
//                    BUYER_REVIEW_DAYS om te accepteren/afwijzen/tegenvoorstel
//   ESCALATED        bij de beheerder (SLA-flag ADMIN_SLA_DAYS)
//   RESOLVED_*       afgerond (BUYER = auto in voordeel koper, SELLER = auto in
//                    voordeel verkoper, MUTUAL = onderling akkoord, ADMIN =
//                    beslissing beheerder), CANCELLED = koper trok in
//
// Regels die de flow waterdicht houden:
//   - Alleen PLATFORM-bundles: SHIPPED (10–30d na verzending, escrow) of
//     COMPLETED ≤ POST_DELIVERY_DAYS na levering (refund uit verkopers-saldo,
//     `fundingSource = SELLER_BALANCE`). EXTERNAL-pickups hebben geen escrow
//     en zijn uitgesloten — daar is "gebruiker melden" de route.
//   - Escalatie naar de beheerder is EENZIJDIG mogelijk zodra de verkoper
//     heeft gereageerd (v1/oude v2 eisten dubbel akkoord — een verkoper kon
//     dan simpelweg weigeren en na 14d automatisch "winnen").
//   - Elke fase heeft een deadline; niets kan eeuwig blijven hangen:
//       OPEN verlopen            → koper wint (verkoper zweeg)
//       SELLER_RESPONDED verlopen → verkoper wint (koper deed niets)
//       MEDIATION verlopen       → automatisch naar de beheerder (er ligt een
//                                  voorstel; niemand "wint" door stilte)
//   - Elke status-flip is race-safe (`updateMany WHERE status = verwacht`),
//     dus dubbelklikken of gelijktijdige acties kunnen nooit dubbel uitbetalen.
//   - De beheerder kan op ELK moment overnemen (adminTakeOverDisputeV2),
//     notities/vragen plaatsen (adminAddDisputeNoteV2) en beslissen
//     (adminResolveDisputeV2 werkt vanuit elke open status).
//
// Geldstromen (refund + vrijgave = altijd exact het resterende bedrag):
//   ESCROW:         refund via refundEscrow/partialRefundEscrow, rest via
//                   releaseEscrow (commissie alleen over het item-deel).
//   SELLER_BALANCE: refund via refundFromSellerBalance (tekort schiet het
//                   platform voor + PendingPlatformFee op verkoper); er is
//                   niets meer vrij te geven.
//   Veilingkosten (buyer's premium) gaan alleen terug bij een VOLLEDIGE refund.

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
  refundFromSellerBalance,
} from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { publish, userChannel } from "@/lib/realtime";
import {
  DISPUTE_V2_OPEN_AFTER_DAYS,
  DISPUTE_V2_WINDOW_DAYS,
  DISPUTE_V2_POST_DELIVERY_DAYS,
  DISPUTE_V2_RESPONSE_DAYS,
  DISPUTE_V2_BUYER_REVIEW_DAYS,
  DISPUTE_V2_ADMIN_SLA_DAYS,
  DISPUTE_V2_MAX_EVIDENCE_PER_PARTY,
  DISPUTE_V2_REASON_CATEGORIES,
  DISPUTE_V2_REASON_LABELS,
  DISPUTE_V2_RESOLUTIONS,
  DISPUTE_V2_RESOLUTION_LABELS,
  DISPUTE_V2_OPEN_STATUS_LIST,
  type DisputeV2ReasonCategory,
  type DisputeV2Resolution,
  type DisputeV2NoteVisibility,
} from "@/lib/dispute-v2/config";

const round2 = (n: number) => Math.round(n * 100) / 100;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
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

function sanitizeUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter(
    (u): u is string => typeof u === "string" && /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(u),
  );
}

function disputeLink(id: string) {
  return `/dashboard/geschillen/${id}`;
}

function publishBoth(buyerId: string, sellerId: string, disputeId: string, status: string) {
  for (const uid of [buyerId, sellerId]) {
    publish(userChannel(uid), { type: "dispute-changed", payload: { disputeId, status } });
  }
}

function publishBalances(...userIds: string[]) {
  for (const uid of userIds) publish(userChannel(uid), { type: "balance-changed", payload: {} });
}

const CONCURRENT_CHANGE = "Het geschil is intussen gewijzigd — ververs de pagina en probeer opnieuw.";

type MoneyBundle = {
  id: string;
  totalCost: number;
  totalItemCost: number;
  refundedAmount: number | null;
  auctionId: string | null;
  deliveredAt: Date | null;
};

/**
 * Centrale geldafwikkeling van een geschil. Wordt aangeroepen NA de
 * race-safe status-flip (die is de claim; dit is de uitvoering). `refund` +
 * `release` = resterend bedrag. Bij SELLER_BALANCE is er niets meer vrij te
 * geven (escrow was al weg).
 */
async function settleDisputeMoney(args: {
  disputeId: string;
  fundingSource: string;
  bundle: MoneyBundle;
  sellerId: string;
  buyerId: string;
  refund: number;
  release: number;
  label: string;
}) {
  const { bundle, sellerId, buyerId, label } = args;
  const refund = round2(args.refund);
  const release = round2(args.release);
  const refundedBefore = bundle.refundedAmount ?? 0;
  const remaining = round2(bundle.totalCost - refundedBefore);
  const isFull = refund > 0 && refund >= remaining - 0.005;
  const shortRef = args.disputeId.slice(0, 8);

  if (args.fundingSource === "SELLER_BALANCE") {
    if (refund > 0) {
      await refundFromSellerBalance(
        sellerId,
        buyerId,
        refund,
        `${label} (geschil ${shortRef})`,
        bundle.id,
      );
    }
  } else {
    if (refund > 0) {
      if (isFull) {
        await refundEscrow(sellerId, buyerId, refund, refund, `${label} (geschil ${shortRef})`, bundle.id);
      } else {
        await partialRefundEscrow(sellerId, buyerId, refund, refund, `${label} (geschil ${shortRef})`, bundle.id);
      }
    }
    if (release > 0) {
      // Commissie alleen over het item-deel; refunds worden conservatief
      // eerst van de items afgeschreven (zelfde regel als confirmDelivery).
      const refundedAfter = refundedBefore + refund;
      const commissionable = Math.min(Math.max(0, bundle.totalItemCost - refundedAfter), release);
      await releaseEscrow(
        sellerId,
        release,
        `Vrijgegeven na geschil ${shortRef}: ${label}`,
        bundle.id,
        commissionable,
      );
    }
  }

  if (isFull && bundle.auctionId) {
    await refundAuctionPremium(buyerId, bundle.auctionId);
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
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  if (!DISPUTE_V2_REASON_CATEGORIES.includes(params.reasonCategory)) {
    return { error: "Ongeldige reden-categorie" };
  }
  if (!params.buyerStatement || params.buyerStatement.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens toelichting in zodat we begrijpen wat er aan de hand is." };
  }
  const evidence = sanitizeUrls(params.evidenceUrls);
  if (evidence.length > DISPUTE_V2_MAX_EVIDENCE_PER_PARTY) {
    return { error: `Maximaal ${DISPUTE_V2_MAX_EVIDENCE_PER_PARTY} foto's.` };
  }

  const bundle = await prisma.shippingBundle.findUnique({
    where: { id: params.bundleId },
    include: {
      disputeV2: { select: { id: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });

  if (!bundle) return { error: "Bestelling niet gevonden" };
  if (bundle.buyerId !== userId) return { error: "Niet geautoriseerd" };
  if (bundle.disputeV2) return { error: "Er loopt of liep al een geschil voor deze bestelling." };
  if (bundle.paymentMode !== "PLATFORM") {
    return {
      error:
        "Deze bestelling is buiten het platform betaald (ophalen). Er is geen bedrag in bewaring om over te beslissen — los het onderling op of meld de gebruiker via zijn profiel.",
    };
  }

  const now = Date.now();
  let fundingSource: "ESCROW" | "SELLER_BALANCE";

  if (bundle.status === "SHIPPED") {
    if (!bundle.shippedAt) {
      return { error: "Bestelling heeft geen verzenddatum — neem contact op met support." };
    }
    const daysSinceShipped = (now - bundle.shippedAt.getTime()) / 86_400_000;
    if (daysSinceShipped < DISPUTE_V2_OPEN_AFTER_DAYS) {
      const remaining = Math.ceil(DISPUTE_V2_OPEN_AFTER_DAYS - daysSinceShipped);
      return {
        error: `Een geschil kan pas ${remaining} dag(en) na verzending geopend worden. Voor tracking-problemen: gebruik 'Trackingprobleem melden'.`,
      };
    }
    if (daysSinceShipped > DISPUTE_V2_WINDOW_DAYS) {
      return { error: `Het geschil-venster van ${DISPUTE_V2_WINDOW_DAYS} dagen na verzending is verstreken.` };
    }
    fundingSource = "ESCROW";
  } else if (bundle.status === "COMPLETED") {
    if (!bundle.deliveredAt) return { error: "Geen leveringsdatum gevonden." };
    const daysSinceDelivered = (now - bundle.deliveredAt.getTime()) / 86_400_000;
    if (daysSinceDelivered > DISPUTE_V2_POST_DELIVERY_DAYS) {
      return {
        error: `Een geschil na levering kan tot ${DISPUTE_V2_POST_DELIVERY_DAYS} dagen na ontvangst geopend worden; dat venster is verstreken.`,
      };
    }
    if (evidence.length === 0) {
      return { error: "Bij een geschil na ontvangst is minimaal één foto verplicht (van het item en/of de verpakking)." };
    }
    fundingSource = "SELLER_BALANCE";
  } else if (bundle.status === "DISPUTED") {
    return { error: "Er loopt al een geschil voor deze bestelling." };
  } else {
    return { error: "Een geschil kan alleen geopend worden op een verzonden of ontvangen bestelling." };
  }

  const responseDeadline = daysFromNow(DISPUTE_V2_RESPONSE_DAYS);
  const expectedStatus = bundle.status;

  let disputeId: string;
  try {
    disputeId = await prisma.$transaction(async (tx) => {
      // Claim de bundle eerst — voorkomt dubbel openen of openen terwijl de
      // koper tegelijk ontvangst bevestigt.
      const claim = await tx.shippingBundle.updateMany({
        where: { id: bundle.id, status: expectedStatus, disputeV2: null },
        data: { status: "DISPUTED" },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");

      const created = await tx.disputeV2.create({
        data: {
          bundleId: bundle.id,
          buyerId: userId,
          sellerId: bundle.sellerId,
          status: "OPEN",
          reasonCategory: params.reasonCategory,
          reasonSubCategory: params.reasonSubCategory?.slice(0, 120) ?? null,
          buyerStatement: params.buyerStatement.trim().slice(0, 4000),
          evidenceBuyer: JSON.stringify(evidence),
          responseDeadline,
          fundingSource,
        },
      });

      await tx.disputeV2Event.create({
        data: {
          disputeId: created.id,
          type: "OPENED",
          actorId: userId,
          actorType: "BUYER",
          message:
            fundingSource === "SELLER_BALANCE"
              ? `Geschil geopend na ontvangst: ${DISPUTE_V2_REASON_LABELS[params.reasonCategory]}`
              : `Geschil geopend: ${DISPUTE_V2_REASON_LABELS[params.reasonCategory]}`,
          metadata: JSON.stringify({
            reasonCategory: params.reasonCategory,
            evidenceCount: evidence.length,
            fundingSource,
            bundleStatusBefore: expectedStatus,
          }),
        },
      });

      return created.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await createNotification(
    bundle.sellerId,
    "DISPUTE_OPENED",
    "Er is een geschil geopend over je verkoop",
    `De koper heeft een geschil geopend over bestelling ${bundle.orderNumber || bundle.id.slice(0, 8)} (${DISPUTE_V2_REASON_LABELS[params.reasonCategory]}). Reageer binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen — anders krijgt de koper automatisch het volledige bedrag terug.`,
    disputeLink(disputeId),
  );

  publishBoth(bundle.buyerId, bundle.sellerId, disputeId, "OPEN");
  publish(userChannel(bundle.buyerId), { type: "bundle-changed", payload: { bundleId: bundle.id, status: "DISPUTED" } });
  publish(userChannel(bundle.sellerId), { type: "bundle-changed", payload: { bundleId: bundle.id, status: "DISPUTED" } });

  return { success: true, disputeId };
}

// ============================================================
// RESPOND (seller) — vanuit OPEN, of vanuit ESCALATED als de beheerder het
// geschil al overnam vóórdat de verkoper reageerde (verklaring blijft welkom).
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
  const evidence = sanitizeUrls(params.evidenceUrls);
  if (evidence.length > DISPUTE_V2_MAX_EVIDENCE_PER_PARTY) {
    return { error: `Maximaal ${DISPUTE_V2_MAX_EVIDENCE_PER_PARTY} foto's.` };
  }

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: params.disputeId },
    include: { bundle: { select: { totalCost: true, refundedAmount: true } } },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };

  const lateInEscalation = dispute.status === "ESCALATED" && !dispute.sellerStatement;
  if (dispute.status !== "OPEN" && !lateInEscalation) {
    return { error: "Het geschil staat niet (meer) open voor een verkopersreactie." };
  }

  // Voorstel: optioneel, alleen vanuit OPEN. > 0 en ≤ resterend bedrag.
  let proposedRefund: number | null = null;
  if (!lateInEscalation && params.proposedRefund !== undefined && params.proposedRefund !== null) {
    if (typeof params.proposedRefund !== "number" || !isFinite(params.proposedRefund) || params.proposedRefund <= 0) {
      return { error: "Voorgesteld bedrag moet groter dan €0 zijn." };
    }
    const maxRefund = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
    if (params.proposedRefund > maxRefund + 0.005) {
      return { error: `Maximum terugbetaling is €${maxRefund.toFixed(2)}` };
    }
    proposedRefund = round2(params.proposedRefund);
  }

  const newStatus = lateInEscalation ? "ESCALATED" : proposedRefund !== null ? "MEDIATION" : "SELLER_RESPONDED";

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status, sellerStatement: lateInEscalation ? null : undefined },
        data: {
          status: newStatus,
          sellerStatement: params.sellerStatement.trim().slice(0, 4000),
          evidenceSeller: JSON.stringify(evidence),
          proposedRefund,
          proposedById: proposedRefund !== null ? session.user.id : null,
          // Generieke reactie-deadline voor de wederpartij (koper).
          buyerReviewDeadline: lateInEscalation ? undefined : daysFromNow(DISPUTE_V2_BUYER_REVIEW_DAYS),
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");

      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: proposedRefund !== null ? "PROPOSAL" : "SELLER_RESPONDED",
          actorId: session.user.id,
          actorType: "SELLER",
          message:
            proposedRefund !== null
              ? `Verkoper heeft gereageerd en stelt €${proposedRefund.toFixed(2)} terugbetaling voor`
              : "Verkoper heeft gereageerd",
          metadata: JSON.stringify({ evidenceCount: evidence.length, proposedRefund }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESPONSE",
    proposedRefund !== null ? "Verkoper stelt een terugbetaling voor" : "Verkoper heeft gereageerd op je geschil",
    proposedRefund !== null
      ? `De verkoper biedt €${proposedRefund.toFixed(2)} terugbetaling aan. Je hebt ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen om te accepteren, af te wijzen of een tegenvoorstel te doen.`
      : lateInEscalation
        ? "De verkoper heeft alsnog een verklaring gegeven. De beheerder neemt die mee in de beoordeling."
        : `Bekijk de reactie. Je hebt ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen om het geschil in te trekken, een voorstel te doen of de beheerder in te schakelen — zonder reactie wordt het geschil gesloten in het voordeel van de verkoper.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, newStatus);
  return { success: true };
}

// ============================================================
// PROPOSE REFUND — beide partijen, vanuit SELLER_RESPONDED of MEDIATION.
// Een nieuw voorstel vervangt het uitstaande voorstel (ook je eigen).
// ============================================================
export async function proposeRefundV2(disputeId: string, amount: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return { error: "Bedrag moet groter dan €0 zijn. Wil je geen terugbetaling? Trek het geschil dan in of laat het voorstel afwijzen." };
  }

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: { bundle: { select: { totalCost: true, refundedAmount: true } } },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (!["SELLER_RESPONDED", "MEDIATION"].includes(dispute.status)) {
    return { error: "Een voorstel kan in deze fase niet gedaan worden." };
  }

  const maxRefund = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
  if (amount > maxRefund + 0.005) return { error: `Maximum terugbetaling is €${maxRefund.toFixed(2)}` };
  const rounded = round2(amount);

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status },
        data: {
          status: "MEDIATION",
          proposedRefund: rounded,
          proposedById: session.user.id,
          buyerReviewDeadline: daysFromNow(DISPUTE_V2_BUYER_REVIEW_DAYS),
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "PROPOSAL",
          actorId: session.user.id,
          actorType: isBuyer ? "BUYER" : "SELLER",
          message: `${isBuyer ? "Koper" : "Verkoper"} stelt €${rounded.toFixed(2)} terugbetaling voor`,
          metadata: JSON.stringify({ proposedRefund: rounded }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  await createNotification(
    otherUserId,
    "DISPUTE_PROPOSAL",
    "Nieuw voorstel in je geschil",
    `${isBuyer ? "De koper" : "De verkoper"} stelt €${rounded.toFixed(2)} terugbetaling voor. Reageer binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen — anders gaat het geschil automatisch naar de beheerder.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "MEDIATION");
  return { success: true };
}

// ============================================================
// ACCEPT PROPOSAL (de andere partij accepteert) → RESOLVED_MUTUAL
// ============================================================
export async function acceptProposalV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: {
      bundle: {
        select: { id: true, totalCost: true, totalItemCost: true, refundedAmount: true, auctionId: true, deliveredAt: true },
      },
    },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "MEDIATION") return { error: "Er is geen openstaand voorstel om te accepteren." };
  if (!dispute.proposedRefund || dispute.proposedRefund <= 0 || !dispute.proposedById) {
    return { error: "Voorstel ontbreekt" };
  }
  if (dispute.proposedById === session.user.id) {
    return { error: "Je kunt je eigen voorstel niet accepteren — de andere partij moet reageren." };
  }

  const remaining = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
  const refundAmount = round2(Math.min(dispute.proposedRefund, remaining));
  const isFull = refundAmount >= remaining - 0.005;
  const releaseAmount = isFull ? 0 : round2(remaining - refundAmount);
  const resolution: DisputeV2Resolution = isFull ? "FULL_REFUND" : "PARTIAL_REFUND";
  const bundleStatusAfter = isFull ? "CANCELLED" : "COMPLETED";
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: "MEDIATION", proposedRefund: dispute.proposedRefund, proposedById: dispute.proposedById },
        data: {
          status: "RESOLVED_MUTUAL",
          resolution,
          finalRefund: refundAmount,
          resolvedAt: now,
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "PROPOSAL_ACCEPTED",
          actorId: session.user.id,
          actorType: isBuyer ? "BUYER" : "SELLER",
          message: `Voorstel geaccepteerd: €${refundAmount.toFixed(2)} terugbetaling`,
          metadata: JSON.stringify({ refundAmount, releaseAmount, resolution }),
        },
      });
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: {
          status: bundleStatusAfter,
          deliveredAt: bundleStatusAfter === "COMPLETED" ? (dispute.bundle.deliveredAt ?? now) : dispute.bundle.deliveredAt,
          refundedAmount: (dispute.bundle.refundedAmount ?? 0) + refundAmount,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await settleDisputeMoney({
    disputeId: dispute.id,
    fundingSource: dispute.fundingSource,
    bundle: dispute.bundle,
    sellerId: dispute.sellerId,
    buyerId: dispute.buyerId,
    refund: refundAmount,
    release: releaseAmount,
    label: "onderling akkoord",
  });

  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost — onderling akkoord",
    `Het geschil is opgelost. €${refundAmount.toFixed(2)} is teruggestort op je saldo.`,
    disputeLink(dispute.id),
  );
  await createNotification(
    dispute.sellerId,
    "DISPUTE_RESOLVED",
    "Geschil opgelost — onderling akkoord",
    releaseAmount > 0
      ? `Het geschil is opgelost. €${refundAmount.toFixed(2)} ging terug naar de koper; het restant is naar je saldo overgeboekt.`
      : `Het geschil is opgelost. €${refundAmount.toFixed(2)} ging terug naar de koper.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "RESOLVED_MUTUAL");
  publishBalances(dispute.buyerId, dispute.sellerId);
  return { success: true };
}

// ============================================================
// REJECT PROPOSAL → terug naar SELLER_RESPONDED (met verse deadline)
// ============================================================
export async function rejectProposalV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };
  if (dispute.status !== "MEDIATION") return { error: "Er is geen openstaand voorstel om af te wijzen." };
  if (dispute.proposedById === session.user.id) {
    return { error: "Je kunt je eigen voorstel niet afwijzen — doe een nieuw voorstel of schakel de beheerder in." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: "MEDIATION" },
        data: {
          status: "SELLER_RESPONDED",
          proposedRefund: null,
          proposedById: null,
          buyerReviewDeadline: daysFromNow(DISPUTE_V2_BUYER_REVIEW_DAYS),
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "PROPOSAL_REJECTED",
          actorId: session.user.id,
          actorType: isBuyer ? "BUYER" : "SELLER",
          message: `${isBuyer ? "Koper" : "Verkoper"} heeft het voorstel afgewezen`,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  await createNotification(
    otherUserId,
    "DISPUTE_PROPOSAL",
    "Je voorstel is afgewezen",
    `${isBuyer ? "De koper" : "De verkoper"} heeft je voorstel afgewezen. Je kunt een nieuw voorstel doen of de beheerder inschakelen.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "SELLER_RESPONDED");
  return { success: true };
}

// ============================================================
// WITHDRAW (koper trekt geschil in) → CANCELLED, verkoper krijgt het
// resterende bedrag (escrow-variant) — koper zegt hiermee "opgelost".
// ============================================================
export async function withdrawDisputeV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: {
      bundle: {
        select: { id: true, totalCost: true, totalItemCost: true, refundedAmount: true, auctionId: true, deliveredAt: true },
      },
    },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.buyerId !== session.user.id) return { error: "Alleen de koper kan een geschil intrekken." };
  if (!["OPEN", "SELLER_RESPONDED", "MEDIATION"].includes(dispute.status)) {
    return { error: "Het geschil kan in deze fase niet meer ingetrokken worden." };
  }

  const remaining = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status },
        data: {
          status: "CANCELLED",
          resolution: "NO_REFUND",
          finalRefund: 0,
          proposedRefund: null,
          proposedById: null,
          resolvedAt: now,
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "CANCELLED",
          actorId: session.user.id,
          actorType: "BUYER",
          message: "Koper heeft het geschil ingetrokken",
        },
      });
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: { status: "COMPLETED", deliveredAt: dispute.bundle.deliveredAt ?? now },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await settleDisputeMoney({
    disputeId: dispute.id,
    fundingSource: dispute.fundingSource,
    bundle: dispute.bundle,
    sellerId: dispute.sellerId,
    buyerId: dispute.buyerId,
    refund: 0,
    release: remaining,
    label: "geschil ingetrokken door koper",
  });

  await createNotification(
    dispute.sellerId,
    "DISPUTE_RESOLVED",
    "Geschil ingetrokken",
    dispute.fundingSource === "ESCROW"
      ? "De koper heeft het geschil ingetrokken. Het bedrag in bewaring is naar je saldo overgeboekt."
      : "De koper heeft het geschil ingetrokken. Er verandert niets aan je saldo.",
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "CANCELLED");
  publishBalances(dispute.sellerId);
  return { success: true };
}

// ============================================================
// ESCALATE — eenzijdig, zodra de verkoper heeft gereageerd.
// ============================================================
export async function requestEscalationV2(disputeId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (dispute.status === "OPEN") {
    return {
      error: isSeller
        ? "Geef eerst je reactie op het geschil; daarna kun je de beheerder inschakelen."
        : `De verkoper heeft tot ${dispute.responseDeadline.toLocaleDateString("nl-NL")} om te reageren. Blijft een reactie uit, dan wordt het geschil automatisch in jouw voordeel afgerond.`,
    };
  }
  if (!["SELLER_RESPONDED", "MEDIATION"].includes(dispute.status)) {
    return { error: "Escaleren is in deze fase niet mogelijk." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status },
        data: { status: "ESCALATED", adminSLADeadline: daysFromNow(DISPUTE_V2_ADMIN_SLA_DAYS) },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId,
          type: "ESCALATED",
          actorId: session.user.id,
          actorType: isBuyer ? "BUYER" : "SELLER",
          message: `${isBuyer ? "Koper" : "Verkoper"} heeft de beheerder ingeschakeld (SLA ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen)`,
          metadata: JSON.stringify({ previousStatus: dispute.status, proposedRefund: dispute.proposedRefund }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  await createNotification(
    otherUserId,
    "DISPUTE_ESCALATED",
    "Geschil naar de beheerder",
    `${isBuyer ? "De koper" : "De verkoper"} heeft de beheerder ingeschakeld. Je kunt nog bewijs toevoegen; de beheerder beslist binnen ongeveer ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen.`,
    disputeLink(dispute.id),
  );
  await notifyAdmins(
    "Geschil geëscaleerd",
    `Een geschil (${dispute.id.slice(0, 8)}) wacht op beoordeling. SLA: ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "ESCALATED");
  return { success: true, escalated: true };
}

async function notifyAdmins(title: string, body: string, link: string) {
  const admins = await prisma.user.findMany({ where: { accountType: "ADMIN" }, select: { id: true } });
  for (const a of admins) {
    await createNotification(a.id, "ADMIN_TASK", title, body, link);
  }
}

// ============================================================
// ADD EVIDENCE (beide partijen, alle open fases incl. ESCALATED)
// ============================================================
export async function addEvidenceV2(params: { disputeId: string; urls: string[] }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const urls = sanitizeUrls(params.urls);
  if (urls.length === 0) return { error: "Geen foto's toegevoegd" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: params.disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  if (!isBuyer && !isSeller) return { error: "Niet geautoriseerd" };

  if (!(DISPUTE_V2_OPEN_STATUS_LIST as readonly string[]).includes(dispute.status)) {
    return { error: "Het geschil is afgerond — bewijs kan niet meer worden toegevoegd." };
  }

  const existing = isBuyer ? parseEvidenceUrls(dispute.evidenceBuyer) : parseEvidenceUrls(dispute.evidenceSeller);
  const merged = [...existing, ...urls.filter((u) => !existing.includes(u))];
  if (merged.length > DISPUTE_V2_MAX_EVIDENCE_PER_PARTY) {
    return { error: `Maximaal ${DISPUTE_V2_MAX_EVIDENCE_PER_PARTY} foto's per partij (je hebt er al ${existing.length}).` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.disputeV2.update({
      where: { id: dispute.id },
      data: isBuyer ? { evidenceBuyer: JSON.stringify(merged) } : { evidenceSeller: JSON.stringify(merged) },
    });
    await tx.disputeV2Event.create({
      data: {
        disputeId: dispute.id,
        type: "EVIDENCE_ADDED",
        actorId: session.user.id,
        actorType: isBuyer ? "BUYER" : "SELLER",
        message: `${isBuyer ? "Koper" : "Verkoper"} voegde ${urls.length} bewijsfoto('s) toe`,
        metadata: JSON.stringify({ count: urls.length }),
      },
    });
  });

  const otherUserId = isBuyer ? dispute.sellerId : dispute.buyerId;
  await createNotification(
    otherUserId,
    "DISPUTE_RESPONSE",
    "Nieuw bewijs in je geschil",
    `${isBuyer ? "De koper" : "De verkoper"} heeft ${urls.length} foto('s) toegevoegd aan het geschil.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, dispute.status);
  return { success: true };
}

// ============================================================
// ADMIN — overnemen (elke open status → ESCALATED)
// ============================================================
export async function adminTakeOverDisputeV2(params: { disputeId: string; reason?: string }) {
  const { adminId } = await requireAdmin();

  const dispute = await prisma.disputeV2.findUnique({ where: { id: params.disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (dispute.status === "ESCALATED") return { error: "Het geschil ligt al bij de beheerder." };
  if (!(DISPUTE_V2_OPEN_STATUS_LIST as readonly string[]).includes(dispute.status)) {
    return { error: "Het geschil is al afgerond." };
  }

  const reason = params.reason?.trim().slice(0, 1000) || "Beheerder heeft het geschil in behandeling genomen";

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status },
        data: { status: "ESCALATED", adminSLADeadline: daysFromNow(DISPUTE_V2_ADMIN_SLA_DAYS) },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "ADMIN_TAKEOVER",
          actorId: adminId,
          actorType: "ADMIN",
          message: reason,
          metadata: JSON.stringify({ previousStatus: dispute.status, visibility: "PARTIES" }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await logAdminAction({
    adminId,
    action: "TAKE_OVER_DISPUTE",
    targetType: "DISPUTE",
    targetId: dispute.id,
    metadata: { previousStatus: dispute.status, reason },
  });

  for (const uid of [dispute.buyerId, dispute.sellerId]) {
    await createNotification(
      uid,
      "DISPUTE_ESCALATED",
      "De beheerder heeft je geschil in behandeling",
      `${reason} Je kunt nog bewijs toevoegen; de beheerder beslist binnen ongeveer ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen.`,
      disputeLink(dispute.id),
    );
  }

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "ESCALATED");
  return { success: true };
}

// ============================================================
// ADMIN — notitie / vraag (INTERNAL = alleen beheerders, PARTIES = beide
// partijen zien 'm in de tijdlijn + krijgen een melding). Mag in elke status,
// ook na afronding (nazorg).
// ============================================================
export async function adminAddDisputeNoteV2(params: {
  disputeId: string;
  message: string;
  visibility: DisputeV2NoteVisibility;
}) {
  const { adminId } = await requireAdmin();

  const message = params.message?.trim().slice(0, 4000) ?? "";
  if (message.length < 3) return { error: "Vul een notitie in." };
  if (params.visibility !== "INTERNAL" && params.visibility !== "PARTIES") return { error: "Ongeldige zichtbaarheid" };

  const dispute = await prisma.disputeV2.findUnique({ where: { id: params.disputeId } });
  if (!dispute) return { error: "Geschil niet gevonden" };

  await prisma.disputeV2Event.create({
    data: {
      disputeId: dispute.id,
      type: "ADMIN_NOTE",
      actorId: adminId,
      actorType: "ADMIN",
      message,
      metadata: JSON.stringify({ visibility: params.visibility }),
    },
  });

  await logAdminAction({
    adminId,
    action: "ADD_DISPUTE_NOTE",
    targetType: "DISPUTE",
    targetId: dispute.id,
    metadata: { visibility: params.visibility, length: message.length },
  });

  if (params.visibility === "PARTIES") {
    for (const uid of [dispute.buyerId, dispute.sellerId]) {
      await createNotification(
        uid,
        "DISPUTE_RESPONSE",
        "Bericht van de beheerder in je geschil",
        message.length > 160 ? `${message.slice(0, 157)}…` : message,
        disputeLink(dispute.id),
      );
    }
    publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, dispute.status);
  }

  return { success: true };
}

// ============================================================
// ADMIN RESOLVE — vanuit elke open status (een niet-geëscaleerd geschil wordt
// impliciet overgenomen; dat staat als event in de tijdlijn).
// ============================================================
export async function adminResolveDisputeV2(params: {
  disputeId: string;
  resolution: DisputeV2Resolution;
  refundAmount?: number;
  adminNotes: string;
}) {
  const { adminId } = await requireAdmin();

  if (!params.adminNotes || params.adminNotes.trim().length < 20) {
    return { error: "Vul minimaal 20 tekens onderbouwing in — beide partijen lezen dit." };
  }
  if (!DISPUTE_V2_RESOLUTIONS.includes(params.resolution)) {
    return { error: "Ongeldige uitkomst" };
  }

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: params.disputeId },
    include: {
      bundle: {
        select: { id: true, totalCost: true, totalItemCost: true, refundedAmount: true, auctionId: true, deliveredAt: true },
      },
    },
  });
  if (!dispute) return { error: "Geschil niet gevonden" };
  if (!(DISPUTE_V2_OPEN_STATUS_LIST as readonly string[]).includes(dispute.status)) {
    return { error: "Het geschil is al afgerond." };
  }

  const remaining = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
  if (remaining <= 0 && params.resolution !== "NO_REFUND") {
    return { error: "Deze bestelling is al volledig terugbetaald — alleen 'geen terugbetaling' is nog mogelijk." };
  }

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
    case "PARTIAL_REFUND": {
      const amount = params.refundAmount;
      if (amount === undefined || amount === null || typeof amount !== "number" || !isFinite(amount)) {
        return { error: "Voor een gedeeltelijke terugbetaling moet je een bedrag invullen." };
      }
      if (amount <= 0 || amount > remaining + 0.005) {
        return { error: `Bedrag moet tussen €0,01 en €${remaining.toFixed(2)} liggen.` };
      }
      finalRefund = round2(amount);
      if (finalRefund >= remaining - 0.005) {
        return { error: "Dit bedrag is het volledige restant — kies dan 'volledige terugbetaling'." };
      }
      releaseAmount = round2(remaining - finalRefund);
      bundleStatusAfter = "COMPLETED";
      break;
    }
  }

  const now = new Date();
  const wasEscalated = dispute.status === "ESCALATED";

  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: dispute.status },
        data: {
          status: "RESOLVED_ADMIN",
          resolution: params.resolution,
          finalRefund,
          adminId,
          adminNotes: params.adminNotes.trim().slice(0, 4000),
          resolvedAt: now,
          proposedRefund: null,
          proposedById: null,
          adminSLADeadline: dispute.adminSLADeadline ?? now,
        },
      });
      if (claim.count === 0) throw new Error("CONCURRENT");

      if (!wasEscalated) {
        await tx.disputeV2Event.create({
          data: {
            disputeId: dispute.id,
            type: "ADMIN_TAKEOVER",
            actorId: adminId,
            actorType: "ADMIN",
            message: "Beheerder heeft het geschil direct in behandeling genomen en beslist",
            metadata: JSON.stringify({ previousStatus: dispute.status, visibility: "PARTIES" }),
          },
        });
      }

      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: {
          status: bundleStatusAfter,
          deliveredAt: bundleStatusAfter === "COMPLETED" ? (dispute.bundle.deliveredAt ?? now) : dispute.bundle.deliveredAt,
          refundedAmount: (dispute.bundle.refundedAmount ?? 0) + finalRefund,
        },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "ADMIN_DECISION",
          actorId: adminId,
          actorType: "ADMIN",
          message: `Beslissing beheerder: ${DISPUTE_V2_RESOLUTION_LABELS[params.resolution]}${finalRefund > 0 ? ` (€${finalRefund.toFixed(2)})` : ""}`,
          metadata: JSON.stringify({ resolution: params.resolution, finalRefund, releaseAmount, fundingSource: dispute.fundingSource }),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONCURRENT") return { error: CONCURRENT_CHANGE };
    throw e;
  }

  await settleDisputeMoney({
    disputeId: dispute.id,
    fundingSource: dispute.fundingSource,
    bundle: dispute.bundle,
    sellerId: dispute.sellerId,
    buyerId: dispute.buyerId,
    refund: finalRefund,
    release: releaseAmount,
    label: `beslissing beheerder — ${DISPUTE_V2_RESOLUTION_LABELS[params.resolution]}`,
  });

  await logAdminAction({
    adminId,
    action: "ADMIN_RESOLVE_DISPUTE",
    targetType: "DISPUTE",
    targetId: dispute.id,
    metadata: {
      resolution: params.resolution,
      finalRefund,
      releaseAmount,
      bundleStatusAfter,
      fundingSource: dispute.fundingSource,
      previousStatus: dispute.status,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      bundleId: dispute.bundle.id,
    },
  });

  const label = DISPUTE_V2_RESOLUTION_LABELS[params.resolution];
  await createNotification(
    dispute.buyerId,
    "DISPUTE_RESOLVED",
    "De beheerder heeft je geschil beslist",
    finalRefund > 0
      ? `Uitkomst: ${label.toLowerCase()} — €${finalRefund.toFixed(2)} is teruggestort op je saldo. De onderbouwing staat bij het geschil.`
      : `Uitkomst: ${label.toLowerCase()}. De onderbouwing staat bij het geschil.`,
    disputeLink(dispute.id),
  );
  await createNotification(
    dispute.sellerId,
    "DISPUTE_RESOLVED",
    "De beheerder heeft het geschil beslist",
    finalRefund > 0
      ? `Uitkomst: ${label.toLowerCase()} — €${finalRefund.toFixed(2)} gaat terug naar de koper${releaseAmount > 0 ? ", het restant is naar je saldo overgeboekt" : ""}. De onderbouwing staat bij het geschil.`
      : `Uitkomst: ${label.toLowerCase()}${dispute.fundingSource === "ESCROW" ? " — het bedrag in bewaring is naar je saldo overgeboekt" : ""}. De onderbouwing staat bij het geschil.`,
    disputeLink(dispute.id),
  );

  publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "RESOLVED_ADMIN");
  publishBalances(dispute.buyerId, dispute.sellerId);
  return { success: true };
}

// ============================================================
// AUTO-RESOLVE (cron) — drie paden, elk race-safe geclaimd.
// ============================================================
export async function autoResolveDisputesV2(): Promise<{ resolved: number; escalated: number }> {
  const now = new Date();
  let resolved = 0;
  let escalated = 0;

  const bundleSelect = {
    id: true,
    totalCost: true,
    totalItemCost: true,
    refundedAmount: true,
    auctionId: true,
    deliveredAt: true,
  } as const;

  // Pad A: OPEN > responseDeadline → verkoper zweeg → volledige refund koper
  const openExpired = await prisma.disputeV2.findMany({
    where: { status: "OPEN", responseDeadline: { lt: now } },
    include: { bundle: { select: bundleSelect } },
  });

  for (const dispute of openExpired) {
    const remaining = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: "OPEN" },
        data: { status: "RESOLVED_BUYER", resolution: "FULL_REFUND", finalRefund: remaining, resolvedAt: now },
      });
      if (claim.count === 0) return false;
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: { status: "CANCELLED", refundedAmount: (dispute.bundle.refundedAmount ?? 0) + remaining },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "AUTO_RESOLVED",
          actorType: "SYSTEM",
          message: `Verkoper heeft niet binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen gereageerd — volledige terugbetaling aan koper`,
          metadata: JSON.stringify({ refund: remaining }),
        },
      });
      return true;
    });
    if (!claimed) continue;

    await settleDisputeMoney({
      disputeId: dispute.id,
      fundingSource: dispute.fundingSource,
      bundle: dispute.bundle,
      sellerId: dispute.sellerId,
      buyerId: dispute.buyerId,
      refund: remaining,
      release: 0,
      label: "verkoper reageerde niet",
    });

    await createNotification(
      dispute.buyerId,
      "DISPUTE_RESOLVED",
      "Geschil afgerond in jouw voordeel",
      `De verkoper heeft niet binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen gereageerd. €${remaining.toFixed(2)} is teruggestort op je saldo.`,
      disputeLink(dispute.id),
    );
    await createNotification(
      dispute.sellerId,
      "DISPUTE_RESOLVED",
      "Geschil afgerond — je hebt niet gereageerd",
      `Je hebt niet binnen ${DISPUTE_V2_RESPONSE_DAYS} dagen op het geschil gereageerd. €${remaining.toFixed(2)} is aan de koper terugbetaald.`,
      disputeLink(dispute.id),
    );

    publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "RESOLVED_BUYER");
    publishBalances(dispute.buyerId, dispute.sellerId);
    resolved++;
  }

  // Pad B: SELLER_RESPONDED > deadline → koper deed niets → verkoper wint
  const responseExpired = await prisma.disputeV2.findMany({
    where: { status: "SELLER_RESPONDED", buyerReviewDeadline: { lt: now } },
    include: { bundle: { select: bundleSelect } },
  });

  for (const dispute of responseExpired) {
    const remaining = round2(dispute.bundle.totalCost - (dispute.bundle.refundedAmount ?? 0));
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: "SELLER_RESPONDED" },
        data: { status: "RESOLVED_SELLER", resolution: "NO_REFUND", finalRefund: 0, resolvedAt: now },
      });
      if (claim.count === 0) return false;
      await tx.shippingBundle.update({
        where: { id: dispute.bundle.id },
        data: { status: "COMPLETED", deliveredAt: dispute.bundle.deliveredAt ?? now },
      });
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "AUTO_RESOLVED",
          actorType: "SYSTEM",
          message: `Koper heeft niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen gereageerd op de verkoper — geschil gesloten zonder terugbetaling`,
        },
      });
      return true;
    });
    if (!claimed) continue;

    await settleDisputeMoney({
      disputeId: dispute.id,
      fundingSource: dispute.fundingSource,
      bundle: dispute.bundle,
      sellerId: dispute.sellerId,
      buyerId: dispute.buyerId,
      refund: 0,
      release: remaining,
      label: "koper reageerde niet",
    });

    await createNotification(
      dispute.sellerId,
      "DISPUTE_RESOLVED",
      "Geschil afgerond in jouw voordeel",
      `De koper heeft niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen gereageerd.${dispute.fundingSource === "ESCROW" ? " Het bedrag in bewaring is naar je saldo overgeboekt." : ""}`,
      disputeLink(dispute.id),
    );
    await createNotification(
      dispute.buyerId,
      "DISPUTE_RESOLVED",
      "Geschil gesloten — je hebt niet gereageerd",
      `Je hebt niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen gereageerd op de verkoper. Het geschil is gesloten zonder terugbetaling.`,
      disputeLink(dispute.id),
    );

    publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "RESOLVED_SELLER");
    publishBalances(dispute.sellerId);
    resolved++;
  }

  // Pad C: MEDIATION > deadline → er ligt een voorstel waar niemand op
  // reageert → automatisch naar de beheerder (stilte wint hier niet).
  const mediationExpired = await prisma.disputeV2.findMany({
    where: { status: "MEDIATION", buyerReviewDeadline: { lt: now } },
  });

  for (const dispute of mediationExpired) {
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.disputeV2.updateMany({
        where: { id: dispute.id, status: "MEDIATION" },
        data: { status: "ESCALATED", adminSLADeadline: daysFromNow(DISPUTE_V2_ADMIN_SLA_DAYS) },
      });
      if (claim.count === 0) return false;
      await tx.disputeV2Event.create({
        data: {
          disputeId: dispute.id,
          type: "ESCALATED",
          actorType: "SYSTEM",
          message: `Geen reactie op het voorstel binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen — automatisch naar de beheerder`,
          metadata: JSON.stringify({ proposedRefund: dispute.proposedRefund, proposedById: dispute.proposedById }),
        },
      });
      return true;
    });
    if (!claimed) continue;

    for (const uid of [dispute.buyerId, dispute.sellerId]) {
      await createNotification(
        uid,
        "DISPUTE_ESCALATED",
        "Geschil automatisch naar de beheerder",
        `Er is niet binnen ${DISPUTE_V2_BUYER_REVIEW_DAYS} dagen op het voorstel gereageerd. De beheerder beoordeelt het geschil nu.`,
        disputeLink(dispute.id),
      );
    }
    await notifyAdmins(
      "Geschil automatisch geëscaleerd",
      `Geschil ${dispute.id.slice(0, 8)}: voorstel bleef onbeantwoord. SLA: ${DISPUTE_V2_ADMIN_SLA_DAYS} dagen.`,
      disputeLink(dispute.id),
    );
    publishBoth(dispute.buyerId, dispute.sellerId, dispute.id, "ESCALATED");
    escalated++;
  }

  return { resolved, escalated };
}
