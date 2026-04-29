"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import {
  getBuybackPrice,
  getStoreCreditBonus,
  checkBuybackEligibility,
  BULK_PRICING,
  MINIMUM_COLLECTION_VALUE,
  MINIMUM_BULK_VALUE,
  MAX_BUYBACK_MARKTPRIJS,
  type BulkCategoryKey,
} from "@/lib/buyback-pricing";
import { getServerMarketPrice } from "@/lib/buyback-pricing-server";
import { submitCollectionBuybackSchema, submitBulkBuybackSchema } from "@/lib/validations/buyback";
import { getCardImageUrl } from "@/lib/card-image";

// ── User actions ─────────────────────────────────────────────────────────────

export async function submitCollectionBuyback(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const raw = {
    items: formData.get("items") as string,
    payoutMethod: formData.get("payoutMethod") as string,
    iban: (formData.get("iban") as string) || undefined,
    accountHolder: (formData.get("accountHolder") as string) || undefined,
    confirmNearMint: formData.get("confirmNearMint") === "true",
    confirmNotOffCenter: formData.get("confirmNotOffCenter") === "true",
  };

  const parsed = submitCollectionBuybackSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validatiefout";
    return { error: firstError };
  }

  const { payoutMethod, iban, accountHolder } = parsed.data;
  const items: Array<{ cardId: string; quantity: number; isReverse?: boolean }> = JSON.parse(parsed.data.items);

  // Re-fetch prices server-side to prevent manipulation
  const itemsWithPrices = [];
  for (const item of items) {
    const marketResult = await getServerMarketPrice(item.cardId, item.isReverse);
    if (!marketResult) {
      return { error: `Kaart ${item.cardId} heeft geen geldige prijs` };
    }

    const card = await prisma.card.findUnique({
      where: { id: item.cardId },
      select: { name: true, localId: true, rarity: true, imageUrl: true, imageUrlFull: true, cardSet: { select: { name: true, releaseDate: true } } },
    });
    if (!card) return { error: `Kaart ${item.cardId} niet gevonden` };

    // McDonald's promo sets are out of scope for the Collection Calculator —
    // same defence in depth as the client-side search filter.
    if (card.cardSet?.name?.startsWith("McDonald")) {
      return { error: `${card.name} (${card.cardSet.name}) komt uit een promo-set die niet ingekocht wordt.` };
    }

    // Block cards beyond the per-card price cap, from sets older than XY,
    // or with a bulk-only rarity (those must go through the Bulk Calculator).
    const elig = checkBuybackEligibility(marketResult.price, card.cardSet?.releaseDate, card.rarity);
    if (!elig.eligible) {
      const label = `${card.name} (${card.cardSet?.name ?? ""})`;
      if (elig.reason === "bulk_only") {
        return { error: `${label} kan alleen via de Bulk Calculator verkocht worden, niet via de Collectie Calculator.` };
      }
      if (elig.reason === "price_too_high") {
        return { error: `${label} heeft een Marktprijs boven €${MAX_BUYBACK_MARKTPRIJS.toFixed(0)} en kan momenteel niet worden ingekocht.` };
      }
      if (elig.reason === "too_old") {
        return { error: `${label} komt uit een set van vóór de XY-serie en kan momenteel niet worden ingekocht.` };
      }
      return { error: `${label} kan momenteel niet worden ingekocht.` };
    }

    const buybackPrice = getBuybackPrice(marketResult.price);
    itemsWithPrices.push({
      cardId: item.cardId,
      cardName: card.name,
      cardLocalId: card.localId ?? "",
      setName: card.cardSet?.name ?? "",
      rarity: card.rarity,
      imageUrl: getCardImageUrl(card, "low"),
      quantity: item.quantity,
      marketPrice: marketResult.price,
      buybackPrice,
      isReverse: marketResult.isReverse,
    });
  }

  const totalItems = itemsWithPrices.reduce((sum, i) => sum + i.quantity, 0);
  const estimatedPayout = itemsWithPrices.reduce((sum, i) => sum + i.buybackPrice * i.quantity, 0);
  const roundedPayout = Math.round(estimatedPayout * 100) / 100;

  if (roundedPayout < MINIMUM_COLLECTION_VALUE) {
    return { error: `Minimale inkoopwaarde is €${MINIMUM_COLLECTION_VALUE.toFixed(2)}` };
  }

  const storeCreditBonus = payoutMethod === "STORE_CREDIT" ? getStoreCreditBonus(roundedPayout) : null;

  // Verkoper moet binnen 5 dagen verzenden — anders kan de huidige Marktprijs-
  // gebaseerde calculatie zijn verlopen en moet de aanvraag opnieuw worden ingediend.
  const shippingDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const request = await prisma.buybackRequest.create({
    data: {
      userId: session.user.id,
      type: "COLLECTION",
      payoutMethod,
      iban: payoutMethod === "BANK" ? iban?.replace(/\s/g, "").toUpperCase() : null,
      accountHolder: payoutMethod === "BANK" ? accountHolder?.trim() : null,
      totalItems,
      estimatedPayout: roundedPayout,
      storeCreditBonus,
      shippingDeadline,
      items: {
        create: itemsWithPrices.map((i) => ({
          cardId: i.cardId,
          cardName: i.cardName,
          cardLocalId: i.cardLocalId,
          setName: i.setName,
          rarity: i.rarity,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          marketPrice: i.marketPrice,
          buybackPrice: i.buybackPrice,
          isReverse: i.isReverse,
        })),
      },
    },
  });

  await createNotification(
    session.user.id,
    "BUYBACK_SUBMITTED",
    "Inkoopaanvraag ingediend",
    `Je inkoopaanvraag met ${totalItems} kaart${totalItems === 1 ? "" : "en"} is ontvangen. Geschatte uitbetaling: €${roundedPayout.toFixed(2)}.`,
    "/dashboard/inkoop"
  );

  return { success: true, requestId: request.id };
}

export async function submitBulkBuyback(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const raw = {
    bulkItems: formData.get("bulkItems") as string,
    payoutMethod: formData.get("payoutMethod") as string,
    iban: (formData.get("iban") as string) || undefined,
    accountHolder: (formData.get("accountHolder") as string) || undefined,
    confirmNearMint: formData.get("confirmNearMint") === "true",
    confirmSorted: formData.get("confirmSorted") === "true",
  };

  const parsed = submitBulkBuybackSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validatiefout";
    return { error: firstError };
  }

  const { payoutMethod, iban, accountHolder } = parsed.data;
  const bulkItems: Array<{ category: string; quantity: number }> = JSON.parse(parsed.data.bulkItems);

  // Validate categories and compute totals
  const validItems = [];
  let totalItems = 0;
  let estimatedPayout = 0;

  for (const item of bulkItems) {
    if (item.quantity <= 0) continue;
    const config = BULK_PRICING[item.category as BulkCategoryKey];
    if (!config) return { error: `Onbekende categorie: ${item.category}` };

    const subtotal = Math.round(item.quantity * config.price * 100) / 100;
    totalItems += item.quantity;
    estimatedPayout += subtotal;

    validItems.push({
      category: item.category,
      quantity: item.quantity,
      unitPrice: config.price,
      subtotal,
    });
  }

  estimatedPayout = Math.round(estimatedPayout * 100) / 100;

  if (validItems.length === 0) {
    return { error: "Voeg minimaal 1 kaart toe" };
  }
  if (estimatedPayout < MINIMUM_BULK_VALUE) {
    return { error: `Minimale inkoopwaarde is €${MINIMUM_BULK_VALUE.toFixed(2)}` };
  }

  const storeCreditBonus = payoutMethod === "STORE_CREDIT" ? getStoreCreditBonus(estimatedPayout) : null;
  const shippingDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const request = await prisma.buybackRequest.create({
    data: {
      userId: session.user.id,
      type: "BULK",
      payoutMethod,
      iban: payoutMethod === "BANK" ? iban?.replace(/\s/g, "").toUpperCase() : null,
      accountHolder: payoutMethod === "BANK" ? accountHolder?.trim() : null,
      totalItems,
      estimatedPayout,
      storeCreditBonus,
      shippingDeadline,
      bulkItems: {
        create: validItems,
      },
    },
  });

  await createNotification(
    session.user.id,
    "BUYBACK_SUBMITTED",
    "Bulk inkoopaanvraag ingediend",
    `Je bulk inkoopaanvraag met ${totalItems} items is ontvangen. Geschatte uitbetaling: €${estimatedPayout.toFixed(2)}.`,
    "/dashboard/inkoop"
  );

  return { success: true, requestId: request.id };
}

// ── Tracking ────────────────────────────────────────────────────────────────

const VALID_CARRIERS = ["PostNL", "DPD", "DHL", "UPS", "OTHER"] as const;
type Carrier = (typeof VALID_CARRIERS)[number];

export async function submitBuybackTracking(
  requestId: string,
  carrier: string,
  trackingNumber: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const trimmedTracking = trackingNumber.trim();
  if (!trimmedTracking || trimmedTracking.length < 4) {
    return { error: "Vul een geldige Track & Trace-code in" };
  }
  if (trimmedTracking.length > 100) {
    return { error: "Track & Trace-code te lang" };
  }
  if (!VALID_CARRIERS.includes(carrier as Carrier)) {
    return { error: "Onbekende vervoerder" };
  }

  const request = await prisma.buybackRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true },
  });
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.userId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (request.status !== "PENDING" && request.status !== "RECEIVED") {
    return { error: "Tracking kan niet meer worden bijgewerkt voor deze aanvraag" };
  }

  await prisma.buybackRequest.update({
    where: { id: requestId },
    data: {
      shippingCarrier: carrier,
      trackingNumber: trimmedTracking,
      shippedAt: new Date(),
    },
  });

  return { success: true };
}

export async function cancelBuybackRequest(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const request = await prisma.buybackRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true },
  });

  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.userId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (request.status !== "PENDING") return { error: "Aanvraag kan niet meer worden geannuleerd" };

  await prisma.buybackRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  return { success: true };
}

export async function getBuybackRequests() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.buybackRequest.findMany({
    where: { userId: session.user.id },
    include: {
      items: true,
      bulkItems: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBuybackRequestDetail(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const request = await prisma.buybackRequest.findUnique({
    where: { id: requestId },
    include: {
      items: true,
      bulkItems: true,
    },
  });

  if (!request) return null;

  // Check ownership or admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  const isAdmin = user?.accountType === "ADMIN";

  if (request.userId !== session.user.id && !isAdmin) return null;

  return request;
}

// ── Admin actions ────────────────────────────────────────��───────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["INSPECTING"],
  INSPECTING: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  PARTIALLY_APPROVED: ["PAID"],
};

interface NotificationContext {
  payout?: number;
  bonus?: number;
  payoutMethod?: string;
}

const STATUS_NOTIFICATIONS: Record<string, { title: string; body: (ctx: NotificationContext) => string }> = {
  RECEIVED: {
    title: "Kaarten ontvangen",
    body: () => "We hebben je kaarten ontvangen. De inspectie kan tot 3 werkdagen duren — je krijgt een melding zodra we starten.",
  },
  INSPECTING: {
    title: "Inspectie gestart",
    body: () => "Je kaarten worden nu gecontroleerd op conditie en kwaliteit.",
  },
  APPROVED: {
    title: "Kaarten goedgekeurd",
    body: ({ payout }) => `Alle kaarten zijn goedgekeurd! Uitbetaling van €${payout?.toFixed(2)} wordt verwerkt.`,
  },
  PARTIALLY_APPROVED: {
    title: "Gedeeltelijk goedgekeurd",
    body: ({ payout }) => `Een deel van je kaarten is goedgekeurd. Uitbetaling van €${payout?.toFixed(2)} wordt verwerkt.`,
  },
  REJECTED: {
    title: "Kaarten afgekeurd",
    body: () => "Helaas zijn je kaarten afgekeurd. Bekijk de details voor meer informatie.",
  },
  PAID: {
    title: "Uitbetaling verwerkt",
    body: ({ payout, bonus, payoutMethod }) => {
      if (payoutMethod === "STORE_CREDIT") {
        const total = (payout ?? 0) + (bonus ?? 0);
        const bonusNote = bonus && bonus > 0 ? ` (incl. €${bonus.toFixed(2)} bonus)` : "";
        return `€${total.toFixed(2)}${bonusNote} is bijgeschreven op je saldo.`;
      }
      return `Je uitbetaling van €${payout?.toFixed(2)} is overgemaakt naar je bankrekening.`;
    },
  },
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  return user?.accountType === "ADMIN" ? session.user.id : null;
}

export async function updateBuybackStatus(
  requestId: string,
  newStatus: string,
  adminNotes?: string
) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Niet geautoriseerd" };

  const request = await prisma.buybackRequest.findUnique({
    where: { id: requestId },
    select: { status: true, userId: true, estimatedPayout: true, finalPayout: true, storeCreditBonus: true, payoutMethod: true },
  });

  if (!request) return { error: "Aanvraag niet gevonden" };

  const allowed = VALID_TRANSITIONS[request.status];
  if (!allowed?.includes(newStatus)) {
    return { error: `Ongeldige statusovergang: ${request.status} → ${newStatus}` };
  }

  const timestamps: Record<string, Date> = {};
  if (newStatus === "RECEIVED") timestamps.receivedAt = new Date();
  if (newStatus === "INSPECTING") timestamps.inspectedAt = new Date();
  if (newStatus === "PAID") timestamps.paidAt = new Date();

  await prisma.buybackRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      adminNotes: adminNotes || undefined,
      inspectedById: adminId,
      ...timestamps,
    },
  });

  // If PAID and store credit, add to user balance
  if (newStatus === "PAID" && request.payoutMethod === "STORE_CREDIT") {
    const payout = request.finalPayout ?? request.estimatedPayout;
    const bonus = request.storeCreditBonus ?? 0;
    const totalCredit = payout + bonus;

    await prisma.user.update({
      where: { id: request.userId },
      data: { balance: { increment: totalCredit } },
    });

    await prisma.transaction.create({
      data: {
        userId: request.userId,
        type: "DEPOSIT",
        amount: totalCredit,
        balanceBefore: 0, // Will be approximate
        balanceAfter: 0,
        description: `Inkoop tegoed uitbetaling (€${payout.toFixed(2)} + €${bonus.toFixed(2)} bonus)`,
      },
    });
  }

  // Send notification
  const notif = STATUS_NOTIFICATIONS[newStatus];
  if (notif) {
    const payout = request.finalPayout ?? request.estimatedPayout;
    await createNotification(
      request.userId,
      `BUYBACK_${newStatus}`,
      notif.title,
      notif.body({
        payout,
        bonus: request.storeCreditBonus ?? 0,
        payoutMethod: request.payoutMethod,
      }),
      `/dashboard/inkoop/${requestId}`
    );
  }

  return { success: true };
}

// ── Price-correction flow ────────────────────────────────────────────────────

export async function applyItemPriceCorrection(
  itemId: string,
  correctedMarketPrice: number,
  reason: string,
) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Niet geautoriseerd" };

  if (!Number.isFinite(correctedMarketPrice) || correctedMarketPrice <= 0) {
    return { error: "Vul een geldige prijs in" };
  }
  if (!reason.trim() || reason.trim().length < 3) {
    return { error: "Beschrijf kort waarom de prijs is aangepast" };
  }

  const item = await prisma.buybackItem.findUnique({
    where: { id: itemId },
    include: { buybackRequest: { select: { status: true, userId: true, id: true } } },
  });
  if (!item) return { error: "Item niet gevonden" };
  if (item.buybackRequest.status !== "INSPECTING") {
    return { error: "Prijscorrectie alleen mogelijk tijdens inspectie" };
  }

  const correctedBuybackPrice = getBuybackPrice(correctedMarketPrice);

  await prisma.buybackItem.update({
    where: { id: itemId },
    data: {
      priceCorrected: true,
      correctedMarketPrice,
      correctedBuybackPrice,
      priceCorrectionReason: reason.trim(),
      userApprovedCorrection: null, // reset bij nieuwe correctie
      userRespondedAt: null,
    },
  });

  await createNotification(
    item.buybackRequest.userId,
    "BUYBACK_PRICE_CORRECTION",
    "Prijscorrectie voorgesteld",
    `Voor "${item.cardName}" hebben we een aangepaste prijs voorgesteld. Bekijk de details en geef akkoord om de inkoop af te ronden.`,
    `/dashboard/inkoop/${item.buybackRequest.id}`,
  );

  return { success: true };
}

export async function respondToPriceCorrection(itemId: string, accept: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const item = await prisma.buybackItem.findUnique({
    where: { id: itemId },
    include: { buybackRequest: { select: { userId: true, status: true } } },
  });
  if (!item) return { error: "Item niet gevonden" };
  if (item.buybackRequest.userId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (!item.priceCorrected) return { error: "Geen prijscorrectie op dit item" };
  if (item.userApprovedCorrection !== null) return { error: "Je hebt al een keuze gemaakt" };
  if (item.buybackRequest.status !== "INSPECTING") {
    return { error: "Niet meer mogelijk om te reageren" };
  }

  await prisma.buybackItem.update({
    where: { id: itemId },
    data: {
      userApprovedCorrection: accept,
      userRespondedAt: new Date(),
      // Als verkoper afwijst, item gaat automatisch naar REJECTED met reden
      ...(accept
        ? {}
        : { inspectionStatus: "REJECTED", rejectionReason: "Verkoper accepteerde de prijscorrectie niet" }),
    },
  });

  return { success: true };
}

export async function inspectBuybackItem(
  itemId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Niet geautoriseerd" };

  await prisma.buybackItem.update({
    where: { id: itemId },
    data: {
      inspectionStatus: status,
      rejectionReason: status === "REJECTED" ? rejectionReason : null,
    },
  });

  return { success: true };
}

export async function inspectBulkBuybackItem(
  itemId: string,
  approvedQuantity: number
) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Niet geautoriseerd" };

  await prisma.bulkBuybackItem.update({
    where: { id: itemId },
    data: { approvedQuantity },
  });

  return { success: true };
}

export async function finalizeBuybackInspection(requestId: string) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Niet geautoriseerd" };

  const request = await prisma.buybackRequest.findUnique({
    where: { id: requestId },
    include: { items: true, bulkItems: true },
  });

  if (!request) return { error: "Aanvraag niet gevonden" };
  if (request.status !== "INSPECTING") return { error: "Aanvraag is niet in inspectiefase" };

  let finalPayout = 0;
  let allApproved = true;
  let allRejected = true;

  if (request.type === "COLLECTION") {
    // Check all items have been inspected
    const pending = request.items.filter((i) => i.inspectionStatus === "PENDING");
    if (pending.length > 0) return { error: `Nog ${pending.length} kaart(en) niet beoordeeld` };

    // Block when there's still a pending price-correction the user hasn't
    // responded to — verkoper moet eerst akkoord geven voordat we finaliseren.
    const pendingCorrections = request.items.filter(
      (i) => i.priceCorrected && i.userApprovedCorrection === null,
    );
    if (pendingCorrections.length > 0) {
      return {
        error: `Nog ${pendingCorrections.length} prijscorrectie(s) wachten op akkoord van de verkoper`,
      };
    }

    for (const item of request.items) {
      if (item.inspectionStatus === "APPROVED") {
        // Use corrected price when verkoper accepted it; original anders.
        const priceToUse =
          item.priceCorrected && item.userApprovedCorrection === true
            ? item.correctedBuybackPrice ?? item.buybackPrice
            : item.buybackPrice;
        finalPayout += priceToUse * item.quantity;
        allRejected = false;
      } else {
        allApproved = false;
      }
    }
  } else {
    // BULK: check all items have approvedQuantity set
    const pending = request.bulkItems.filter((i) => i.approvedQuantity === null);
    if (pending.length > 0) return { error: `Nog ${pending.length} categorie(ën) niet beoordeeld` };

    for (const item of request.bulkItems) {
      const approved = item.approvedQuantity ?? 0;
      if (approved > 0) {
        finalPayout += approved * item.unitPrice;
        allRejected = false;
      }
      if (approved < item.quantity) {
        allApproved = false;
      }
    }
  }

  finalPayout = Math.round(finalPayout * 100) / 100;

  let newStatus: string;
  if (allRejected) {
    newStatus = "REJECTED";
  } else if (allApproved) {
    newStatus = "APPROVED";
  } else {
    newStatus = "PARTIALLY_APPROVED";
  }

  const storeCreditBonus =
    request.payoutMethod === "STORE_CREDIT" ? getStoreCreditBonus(finalPayout) : null;

  await prisma.buybackRequest.update({
    where: { id: requestId },
    data: {
      status: newStatus,
      finalPayout,
      storeCreditBonus,
      inspectedAt: new Date(),
      inspectedById: adminId,
    },
  });

  // Send notification
  const notif = STATUS_NOTIFICATIONS[newStatus];
  if (notif) {
    await createNotification(
      request.userId,
      `BUYBACK_${newStatus}`,
      notif.title,
      notif.body({
        payout: finalPayout,
        bonus: storeCreditBonus ?? 0,
        payoutMethod: request.payoutMethod,
      }),
      `/dashboard/inkoop/${requestId}`
    );
  }

  return { success: true, status: newStatus, finalPayout };
}

export async function markBuybackPaid(requestId: string) {
  return updateBuybackStatus(requestId, "PAID");
}

// ── Admin queries ────────────────────────────────────────────────────────────

export async function getAllBuybackRequests(status?: string) {
  const adminId = await requireAdmin();
  if (!adminId) return [];

  return prisma.buybackRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      user: { select: { displayName: true, email: true } },
      items: true,
      bulkItems: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
