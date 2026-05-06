"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { publishNewMessageForConversation } from "@/actions/message";
import { generateOrderNumber } from "@/lib/order-number";
import { getBlockedUserIds } from "@/lib/blocking";
import { createBundleOfferSchema, acceptBundleOfferShippingSchema, counterBundleOfferSchema } from "@/lib/validations/bundle-offer";
import {
  BUNDLE_OFFER_EXPIRY_DAYS,
  BUNDLE_PAYMENT_DEADLINE_DAYS_SHIP,
  PICKUP_RESERVATION_DAYS,
  MAX_COUNTER_DEPTH,
} from "@/lib/bundle-offer-config";
import { requiresSignedShipping } from "@/lib/shipping/tracked-threshold";
import type { Prisma } from "@prisma/client";

// Helper-shape voor bp.listings na include
type BundleListingEntry = {
  listingId: string;
  quantity: number;
  itemIds: string | null;
  priceSnapshot: number | null;
  listing: { id: string; title: string; price: number | null; listingType: string; allowPartialSale: boolean };
};

// Per BundleProposalListing-entry de juiste items flip naar targetStatus.
// Drie paden:
// - Hele listing single-flip (SINGLE_CARD / COLLECTION / MULTI_CARD zonder
//   allowPartialSale / stocked zonder quantity > 1): listing.status flip
//   ACTIVE → targetStatus, buyerId zetten op listing.
// - Stocked partial (SEALED/OTHER met quantity > 1): pak eerste N AVAILABLE
//   cardItemRows, flip naar targetStatus + buyerId, koppel aan bundle.
//   Listing-status wordt PARTIALLY_SOLD als nog AVAILABLE items, anders SOLD.
// - MULTI_CARD partial (allowPartialSale + itemIds): flip die specifieke
//   items, zelfde listing-status logica.
//
// Throw bij mismatch (race-condition: items zijn intussen weggekocht).
async function flipBundleListingItems(
  tx: Prisma.TransactionClient,
  entries: BundleListingEntry[],
  targetStatus: "SOLD" | "RESERVED",
  buyerId: string,
  shippingBundleId: string | null
): Promise<void> {
  for (const entry of entries) {
    const isMultiPartial = entry.listing.listingType === "MULTI_CARD" && entry.listing.allowPartialSale;
    const isStocked = entry.listing.listingType === "SEALED_PRODUCT" || entry.listing.listingType === "OTHER";

    let itemIds: string[] | null = null;
    if (entry.itemIds) {
      try {
        const parsed = JSON.parse(entry.itemIds);
        if (Array.isArray(parsed)) itemIds = parsed;
      } catch {
        // ignore
      }
    }

    const isPartialFlow = (isMultiPartial && itemIds) || (isStocked && entry.quantity > 1);

    if (isPartialFlow) {
      // Stocked OF MULTI_CARD partial — items per stuk flippen
      let targetIds: string[];
      if (itemIds) {
        // MULTI_CARD partial: exacte items
        targetIds = itemIds;
      } else {
        // Stocked: pak eerste N AVAILABLE. Race met andere parallel-accept:
        // tweede flipt minder items want updateMany count<N → throw + tx
        // rollback. Buyer ziet duidelijke foutmelding ipv stille fail.
        const available = await tx.listingCardItem.findMany({
          where: { listingId: entry.listingId, status: "AVAILABLE" },
          select: { id: true },
          take: entry.quantity,
        });
        if (available.length !== entry.quantity) {
          throw new Error(`"${entry.listing.title}" — slechts ${available.length} stuks beschikbaar (was ${entry.quantity}). Pas je voorstel aan.`);
        }
        targetIds = available.map((r) => r.id);
      }

      const flipped = await tx.listingCardItem.updateMany({
        where: { id: { in: targetIds }, status: "AVAILABLE" },
        data: {
          status: targetStatus,
          buyerId,
          ...(targetStatus === "SOLD" ? { soldAt: new Date(), shippingBundleId } : { shippingBundleId }),
        },
      });
      if (flipped.count !== targetIds.length) {
        throw new Error(`"${entry.listing.title}" — items zijn intussen weggekocht door een andere koper. Probeer opnieuw met een lager aantal.`);
      }

      // Listing-status: PARTIALLY_SOLD als nog AVAILABLE, anders SOLD.
      const remainingAvailable = await tx.listingCardItem.count({
        where: { listingId: entry.listingId, status: "AVAILABLE" },
      });
      const remainingSold = await tx.listingCardItem.count({
        where: { listingId: entry.listingId, status: "SOLD" },
      });
      const newListingStatus = remainingAvailable === 0
        ? (remainingSold > 0 ? "SOLD" : "PARTIALLY_SOLD")
        : "PARTIALLY_SOLD";
      await tx.listing.updateMany({
        where: { id: entry.listingId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
        data: { status: newListingStatus },
      });
    } else {
      // Hele listing flip ACTIVE → targetStatus
      const flipped = await tx.listing.updateMany({
        where: { id: entry.listingId, status: "ACTIVE" },
        data: { status: targetStatus, buyerId },
      });
      if (flipped.count === 0) {
        throw new Error(`"${entry.listing.title}" is niet meer beschikbaar`);
      }
    }
  }
}

// Fase 27.66: per listing optioneel quantity (stocked) of itemIds (MULTI_CARD
// partial-sale). Default 1, geen itemIds = hele listing flip.
interface CreateBundleOfferInput {
  conversationId: string;
  listings: Array<{ listingId: string; quantity?: number; itemIds?: string[] }>;
  totalAmount: number;
  deliveryChoice: "SHIP" | "PICKUP_PLATFORM" | "PICKUP_EXTERNAL";
  requestInsuredShipping?: boolean;
}

// Buyer creates a bundle-offer in an existing chat. Listings stay ACTIVE during
// the PENDING phase — we resolve the lock atomically only at seller-accept.
export async function createBundleOffer(input: CreateBundleOfferInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const buyerId = session.user.id;

  const parsed = createBundleOfferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Conversation + tegenpartij (seller) bepalen
  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation) return { error: "Gesprek niet gevonden" };

  const isBuyerParticipant = conversation.participants.some((p) => p.userId === buyerId);
  if (!isBuyerParticipant) return { error: "Niet geautoriseerd" };

  const sellerId = conversation.participants.find((p) => p.userId !== buyerId)?.userId;
  if (!sellerId) return { error: "Tegenpartij niet gevonden" };

  // Buyer vs seller blocking-check
  const blocked = await getBlockedUserIds(buyerId);
  if (blocked.has(sellerId)) return { error: "Niet beschikbaar" };

  // Listings ophalen + valideren — incl. cardItemRows voor stocked-quantity
  // en MULTI_CARD partial-sale-validatie.
  const listingIds = data.listings.map((l) => l.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      sellerId: true,
      status: true,
      title: true,
      price: true,
      deliveryMethod: true,
      listingType: true,
      allowPartialSale: true,
      allowPlatformPickup: true,
      allowExternalPickup: true,
      cardItemRows: { where: { status: "AVAILABLE" }, select: { id: true } },
    },
  });
  if (listings.length !== listingIds.length) {
    return { error: "Eén of meer advertenties niet gevonden" };
  }
  const wantsPickup = data.deliveryChoice !== "SHIP";
  const wantsPlatformPickup = data.deliveryChoice === "PICKUP_PLATFORM";
  const wantsExternalPickup = data.deliveryChoice === "PICKUP_EXTERNAL";
  const listingMap = new Map(listings.map((l) => [l.id, l]));
  for (const entry of data.listings) {
    const l = listingMap.get(entry.listingId);
    if (!l) return { error: "Eén of meer advertenties niet gevonden" };
    if (l.sellerId !== sellerId) return { error: "Alle advertenties moeten van dezelfde verkoper zijn" };
    if (l.status !== "ACTIVE") return { error: `"${l.title}" is niet meer beschikbaar` };
    if (wantsPickup && l.deliveryMethod !== "PICKUP" && l.deliveryMethod !== "BOTH") {
      return { error: `"${l.title}" ondersteunt geen ophalen` };
    }
    if (wantsPlatformPickup && !l.allowPlatformPickup) {
      return { error: `"${l.title}" accepteert geen wallet-betaling voor ophalen` };
    }
    if (wantsExternalPickup && !l.allowExternalPickup) {
      return { error: `"${l.title}" accepteert geen ophaal-betaling — kies wallet-vooraf` };
    }
    // Per-listing quantity / itemIds validatie
    const isStocked = (l.listingType === "SEALED_PRODUCT" || l.listingType === "OTHER") && l.cardItemRows.length > 0;
    const isMultiPartial = l.listingType === "MULTI_CARD" && l.allowPartialSale && l.cardItemRows.length > 0;
    const qty = entry.quantity ?? 1;
    // Quantity moet minstens 1 zijn (Fase 27.78). Zod-coerce kan undefined →
    // default 1 doen, maar bij expliciet 0 of negatief moet hij hard falen.
    if (qty < 1) {
      return { error: `"${l.title}": aantal moet minstens 1 zijn` };
    }
    if (entry.itemIds && entry.itemIds.length > 0) {
      // MULTI_CARD partial-sale: itemIds moeten bestaan + AVAILABLE zijn
      if (!isMultiPartial) {
        return { error: `"${l.title}" ondersteunt geen item-selectie` };
      }
      const availableSet = new Set(l.cardItemRows.map((r) => r.id));
      for (const id of entry.itemIds) {
        if (!availableSet.has(id)) return { error: `"${l.title}": een gekozen item is niet meer beschikbaar` };
      }
    } else if (qty > 1) {
      // Stocked listing met quantity > 1: check voorraad
      if (!isStocked) {
        return { error: `"${l.title}" ondersteunt geen aantal-keuze` };
      }
      if (qty > l.cardItemRows.length) {
        return { error: `"${l.title}": slechts ${l.cardItemRows.length} stuks beschikbaar` };
      }
    }
  }
  // Geen shippingMethodId-validatie meer bij offer-creation. Seller kiest die
  // bij accept; server forceert isSigned als requestInsuredShipping=true of
  // wanneer requiresSignedShipping(totalAmount, isInternational) true is.

  // Eén PENDING bundle-offer per (conversation, buyer) tegelijk om spam te beperken.
  const existing = await prisma.bundleProposal.findFirst({
    where: { conversationId: data.conversationId, buyerId, status: "PENDING" },
  });
  if (existing) return { error: "Er staat al een bundel-voorstel open. Trek dat eerst in." };

  // deliveryMethod (SHIP|PICKUP) en paymentMode (PLATFORM|EXTERNAL) afgeleid
  // uit de 3-way keuze. Beide worden los opgeslagen op BundleProposal voor
  // backward compat met bestaande respondToBundleOffer-branches.
  const deliveryMethodForDb = data.deliveryChoice === "SHIP" ? "SHIP" : "PICKUP";
  const paymentMode = data.deliveryChoice === "PICKUP_EXTERNAL" ? "EXTERNAL" : "PLATFORM";
  const expiresAt = new Date(Date.now() + BUNDLE_OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Korte chat-omschrijving per keuze. NL strings — chat-bubble blijft NL.
  const choiceLabel =
    data.deliveryChoice === "SHIP"
      ? "verzenden"
      : data.deliveryChoice === "PICKUP_PLATFORM"
        ? "ophalen, vooraf via wallet"
        : "ophalen, betalen bij ophalen";

  const created = await prisma.$transaction(async (tx) => {
    const bp = await tx.bundleProposal.create({
      data: {
        conversationId: data.conversationId,
        buyerId,
        sellerId,
        totalAmount: data.totalAmount,
        deliveryMethod: deliveryMethodForDb,
        requestInsuredShipping: data.requestInsuredShipping,
        paymentMode,
        status: "PENDING",
        expiresAt,
        listings: {
          create: data.listings.map((entry) => {
            const l = listingMap.get(entry.listingId)!;
            return {
              listingId: l.id,
              priceSnapshot: l.price ?? null,
              quantity: entry.quantity ?? 1,
              itemIds: entry.itemIds && entry.itemIds.length > 0 ? JSON.stringify(entry.itemIds) : null,
            };
          }),
        },
      },
    });

    await tx.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: buyerId,
        body: `Bundel-voorstel: ${listings.length} advertenties voor €${data.totalAmount.toFixed(2)} (${choiceLabel})`,
        bundleProposalId: bp.id,
      },
    });

    return bp;
  });

  await createNotification(
    sellerId,
    "NEW_MESSAGE",
    "Bundel-voorstel ontvangen",
    `Een koper biedt €${data.totalAmount.toFixed(2)} voor ${listings.length} advertenties.`,
    `/nl/berichten/${data.conversationId}`
  );

  await publishNewMessageForConversation(
    data.conversationId,
    buyerId,
    `📦 Bundel-voorstel: ${listings.length} ads — €${data.totalAmount.toFixed(2)}`,
  );

  return { success: true, bundleProposalId: created.id };
}

// Buyer trekt eigen PENDING offer in.
export async function withdrawBundleOffer(bundleProposalId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bp = await prisma.bundleProposal.findUnique({
    where: { id: bundleProposalId },
    select: { id: true, buyerId: true, sellerId: true, status: true, conversationId: true, totalAmount: true },
  });
  if (!bp) return { error: "Voorstel niet gevonden" };
  if (bp.buyerId !== session.user.id && bp.sellerId !== session.user.id) {
    return { error: "Niet geautoriseerd" };
  }
  // Alleen de proposer mag withdrawn — check via eerste chat-message.
  const proposerMessage = await prisma.message.findFirst({
    where: { bundleProposalId: bp.id },
    orderBy: { createdAt: "asc" },
    select: { senderId: true },
  });
  if (proposerMessage && proposerMessage.senderId !== session.user.id) {
    return { error: "Alleen de aanvrager kan dit voorstel intrekken" };
  }
  if (bp.status !== "PENDING") return { error: "Voorstel is al beantwoord" };

  await prisma.bundleProposal.updateMany({
    where: { id: bundleProposalId, status: "PENDING" },
    data: { status: "WITHDRAWN", respondedAt: new Date() },
  });

  await prisma.message.create({
    data: {
      conversationId: bp.conversationId,
      senderId: session.user.id,
      body: `Bundel-voorstel ingetrokken door koper.`,
      bundleProposalId: bp.id,
    },
  });

  await createNotification(
    bp.sellerId,
    "NEW_MESSAGE",
    "Bundel-voorstel ingetrokken",
    `Het bundel-voorstel van €${bp.totalAmount.toFixed(2)} is ingetrokken.`,
    `/nl/berichten/${bp.conversationId}`
  );

  await publishNewMessageForConversation(
    bp.conversationId,
    session.user.id,
    `🚫 Bundel-voorstel ingetrokken (€${bp.totalAmount.toFixed(2)})`,
  );

  return { success: true };
}

// Tegenbod doen op een PENDING bundle-offer (Fase 27.70). Tegenpartij
// (= NIET de proposer) kiest een nieuw totaalbedrag en verstuurt. Het
// originele voorstel gaat naar COUNTERED, een nieuw child-voorstel komt
// in PENDING met dezelfde listings/items maar met buyer/seller gezwapt
// — de oorspronkelijke proposer is nu de tegenpartij van de counter.
//
// Counter-chain depth wordt afgekapt op MAX_COUNTER_DEPTH om eindeloze
// onderhandelingen te voorkomen.
export async function counterBundleOffer(input: { parentProposalId: string; totalAmount: number }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const parsed = counterBundleOfferSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const parent = await prisma.bundleProposal.findUnique({
    where: { id: parsed.data.parentProposalId },
    include: { listings: { include: { listing: true } } },
  });
  if (!parent) return { error: "Voorstel niet gevonden" };
  if (parent.status !== "PENDING") return { error: "Voorstel is al beantwoord" };

  // Alleen de tegenpartij mag counter-bieden — niet de huidige proposer.
  // Proposer = wie het bundle-message stuurde (via senderId van eerste message).
  const isSeller = parent.sellerId === session.user.id;
  const isBuyer = parent.buyerId === session.user.id;
  if (!isSeller && !isBuyer) return { error: "Niet geautoriseerd" };
  const parentProposer = await prisma.message.findFirst({
    where: { bundleProposalId: parent.id },
    orderBy: { createdAt: "asc" },
    select: { senderId: true },
  });
  if (parentProposer?.senderId === session.user.id) {
    return { error: "Je kunt geen tegenbod doen op je eigen voorstel" };
  }

  // Counter-chain depth check
  let depth = 0;
  let cursor: { parentProposalId: string | null } | null = parent;
  while (cursor?.parentProposalId) {
    depth++;
    if (depth >= MAX_COUNTER_DEPTH) {
      return { error: `Maximaal ${MAX_COUNTER_DEPTH} tegenbiedingen per onderhandeling.` };
    }
    cursor = await prisma.bundleProposal.findUnique({
      where: { id: cursor.parentProposalId },
      select: { parentProposalId: true },
    });
  }

  // Tx: parent → COUNTERED, child PENDING met zelfde listings/items.
  // Atomic flip via updateMany met status-filter (Fase 27.80) — voorkomt
  // dat twee parallelle counter-bids elk een PENDING child aanmaken.
  // Tweede tx krijgt count=0 en aborteert.
  const expiresAt = new Date(Date.now() + BUNDLE_OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const child = await prisma.$transaction(async (tx) => {
    const flipped = await tx.bundleProposal.updateMany({
      where: { id: parent.id, status: "PENDING" },
      data: { status: "COUNTERED", respondedAt: new Date() },
    });
    if (flipped.count === 0) {
      throw new Error("Voorstel is al beantwoord — herlaad de pagina.");
    }

    const newProposer = session.user!.id!;
    const newRecipient = isSeller ? parent.buyerId : parent.sellerId;
    // Convention behouden: buyerId = wie de bundle koopt = oorspronkelijke buyer.
    // Counter wijzigt alleen het bedrag, niet wie wat krijgt. We zwappen geen
    // koop-richting — de oorspronkelijke buyer blijft koper. We tracken
    // alleen wie het LAATSTE voorstel deed via een nieuw veld? Nee: parent
    // heeft sellerId/buyerId; we kopiëren die. De UI bepaalt wie nu mag
    // antwoorden via vergelijking met de senderId van het laatste message.
    const childCreated = await tx.bundleProposal.create({
      data: {
        conversationId: parent.conversationId,
        buyerId: parent.buyerId,
        sellerId: parent.sellerId,
        totalAmount: parsed.data.totalAmount,
        deliveryMethod: parent.deliveryMethod,
        paymentMode: parent.paymentMode,
        requestInsuredShipping: parent.requestInsuredShipping,
        parentProposalId: parent.id,
        status: "PENDING",
        expiresAt,
        listings: {
          create: parent.listings.map((bl) => ({
            listingId: bl.listingId,
            // priceSnapshot fresh van listing (Fase 27.80) — als seller
            // tussen parent en counter de prijs verlaagde, neemt counter
            // de actuele waarde over. priceSnapshot is informatief in
            // dashboards; totalAmount blijft leidend voor wallet.
            priceSnapshot: bl.listing.price ?? bl.priceSnapshot,
            quantity: bl.quantity,
            itemIds: bl.itemIds,
          })),
        },
      },
    });
    // Chat-systeembericht
    await tx.message.create({
      data: {
        conversationId: parent.conversationId,
        senderId: newProposer,
        body: `Tegenbod: €${parsed.data.totalAmount.toFixed(2)} (was €${parent.totalAmount.toFixed(2)}).`,
        bundleProposalId: childCreated.id,
      },
    });
    // Notificatie naar tegenpartij
    void newRecipient;
    return childCreated;
  });

  await createNotification(
    isSeller ? parent.buyerId : parent.sellerId,
    "NEW_MESSAGE",
    "Tegenbod ontvangen",
    `Een tegenbod van €${parsed.data.totalAmount.toFixed(2)} is binnengekomen.`,
    `/nl/berichten/${parent.conversationId}`
  );

  await publishNewMessageForConversation(
    parent.conversationId,
    session.user.id,
    `↪️ Tegenbod €${parsed.data.totalAmount.toFixed(2)}`,
  );

  return { success: true, childId: child.id };
}

// Seller accepteert of weigert een bundle-offer.
// ACCEPT-flow heeft 3 sub-flows: SHIP+full-balance, SHIP+partial-balance,
// PICKUP (off-platform). Bij SHIP-bundles geeft de seller een shippingMethodId
// op; server valideert isSigned wanneer buyer requestInsuredShipping=true
// gevraagd heeft of wanneer het bedrag/internationale verzending
// `requiresSignedShipping` triggeren.
export async function respondToBundleOffer(
  bundleProposalId: string,
  action: "ACCEPT" | "REJECT",
  shippingMethodId?: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const bp = await prisma.bundleProposal.findUnique({
    where: { id: bundleProposalId },
    include: { listings: { include: { listing: true } } },
  });
  if (!bp) return { error: "Voorstel niet gevonden" };
  // Both buyer en seller mogen reageren — maar NIET de proposer zelf.
  // Proposer = wie het bundle-message stuurde (via senderId van eerste message).
  if (bp.buyerId !== session.user.id && bp.sellerId !== session.user.id) {
    return { error: "Niet geautoriseerd" };
  }
  const proposerMessage = await prisma.message.findFirst({
    where: { bundleProposalId: bp.id },
    orderBy: { createdAt: "asc" },
    select: { senderId: true },
  });
  if (proposerMessage?.senderId === session.user.id) {
    return { error: "Je kunt niet je eigen voorstel accepteren of afwijzen" };
  }
  if (bp.status !== "PENDING") return { error: "Voorstel is al beantwoord" };

  if (action === "REJECT") {
    await prisma.bundleProposal.updateMany({
      where: { id: bundleProposalId, status: "PENDING" },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    await prisma.message.create({
      data: {
        conversationId: bp.conversationId,
        senderId: session.user.id,
        body: `Bundel-voorstel afgewezen door verkoper.`,
        bundleProposalId: bp.id,
      },
    });

    await createNotification(
      bp.buyerId,
      "NEW_MESSAGE",
      "Bundel-voorstel afgewezen",
      `Je bundel-voorstel van €${bp.totalAmount.toFixed(2)} is afgewezen.`,
      `/nl/berichten/${bp.conversationId}`
    );
    await publishNewMessageForConversation(
      bp.conversationId,
      session.user.id,
      `❌ Bundel-voorstel afgewezen (€${bp.totalAmount.toFixed(2)})`,
    );
    return { success: true };
  }

  // ACCEPT — buyer-saldo voor PLATFORM checken
  const buyer = await prisma.user.findUnique({ where: { id: bp.buyerId } });
  if (!buyer) return { error: "Koper niet gevonden" };

  const listingIds = bp.listings.map((bl) => bl.listingId);
  const totalAmount = bp.totalAmount;

  // Voor SHIP-bundles: seller moet een shipping-method kiezen, server valideert
  // de isSigned-eis (buyer-toggle of bedrag/internationaal-regelwerk).
  let acceptedShippingMethodId: string | null = null;
  let acceptedShippingPrice = 0;
  if (bp.paymentMode === "PLATFORM" && bp.deliveryMethod === "SHIP") {
    const parsed = acceptBundleOfferShippingSchema.safeParse({ bundleProposalId, shippingMethodId });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (!parsed.data.shippingMethodId) return { error: "Kies een verzendmethode om de bundel te accepteren" };

    const method = await prisma.sellerShippingMethod.findFirst({
      where: { id: parsed.data.shippingMethodId, sellerId: bp.sellerId, isActive: true },
      select: { id: true, isTracked: true, isSigned: true, shippingType: true, price: true },
    });
    if (!method) return { error: "Verzendmethode niet beschikbaar" };
    if (method.shippingType === "LETTER") {
      return { error: "Briefpost is niet toegestaan voor bundels — kies een pakket-methode" };
    }

    const seller = await prisma.user.findUnique({ where: { id: bp.sellerId }, select: { country: true } });
    const isInternational = seller?.country !== buyer.country;
    const mustBeSigned = bp.requestInsuredShipping || requiresSignedShipping(totalAmount, isInternational);
    if (mustBeSigned && !method.isSigned) {
      return {
        error: bp.requestInsuredShipping
          ? "De koper heeft verzekerd verzonden gevraagd — kies een aangetekende methode."
          : `Voor bundels >€150 of internationaal is aangetekende verzending verplicht.`,
      };
    }
    acceptedShippingMethodId = method.id;
    acceptedShippingPrice = method.price;
  }

  // Fase 32: splits totalAmount in items + shipping zodat commissie alleen
  // over items wordt geheven via releaseEscrow's commissionableAmount.
  // Buyer voert "totaalbedrag (incl. verzending)" in — voor SHIP-bundles is
  // shipping de prijs van de gekozen SellerShippingMethod; voor PICKUP-
  // bundles is shipping €0. Clamp itemsTotal op 0 als seller een methode
  // koos die duurder is dan het bod (edge-case; seller had moeten weigeren).
  const shippingCostForBundle = bp.deliveryMethod === "SHIP" ? acceptedShippingPrice : 0;
  const itemsTotalForBundle = Math.max(
    Math.round((totalAmount - shippingCostForBundle) * 100) / 100,
    0,
  );

  if (bp.paymentMode === "PLATFORM") {
    if (!buyer.street || !buyer.postalCode || !buyer.city) {
      return { error: "Koper heeft nog geen adres ingevuld" };
    }

    const availableBalance = buyer.balance - buyer.reservedBalance;
    const isFullPayment = availableBalance >= totalAmount;

    if (isFullPayment) {
      // Full payment — atomic flip + escrow + bundle PAID. Voor stocked +
      // MULTI_CARD partial: items per stuk via flipBundleListingItems.
      const result = await prisma.$transaction(async (tx) => {
        const bundle = await tx.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId: bp.buyerId,
            sellerId: bp.sellerId,
            shippingCost: shippingCostForBundle,
            totalItemCost: itemsTotalForBundle,
            totalCost: totalAmount,
            status: "PAID",
            shippingMethodId: acceptedShippingMethodId,
            paymentMode: "PLATFORM",
            deliveryMethod: bp.deliveryMethod,
            bundleProposalId: bp.id,
            buyerStreet: buyer.street,
            buyerHouseNumber: buyer.houseNumber,
            buyerPostalCode: buyer.postalCode,
            buyerCity: buyer.city,
            buyerCountry: buyer.country,
            bundleListings: {
              create: bp.listings.map((bl) => ({
                listingId: bl.listingId,
                priceSnapshot: bl.priceSnapshot ?? bl.listing.price ?? 0,
              })),
            },
          },
        });

        await flipBundleListingItems(tx, bp.listings as BundleListingEntry[], "SOLD", bp.buyerId, bundle.id);

        await tx.bundleProposal.update({
          where: { id: bp.id },
          data: { status: "ACCEPTED", paymentStatus: "PAID", respondedAt: new Date() },
        });

        return bundle;
      });

      // Wallet-mutaties buiten de tx — best-effort rollback bij faal.
      try {
        await deductBalance(bp.buyerId, totalAmount, "PURCHASE", `Bundel-aankoop (${listingIds.length} advertenties)`, undefined, undefined, undefined);
        await escrowCredit(bp.sellerId, totalAmount, `Bundel-verkoop (escrow, ${listingIds.length} advertenties)`, result.id);
      } catch (e) {
        // Rollback: items + listings terug ACTIVE, bundle CANCELLED, offer REJECTED.
        // Voor partial-flow gebruiken we updateMany op shippingBundleId om
        // items terug te zetten; non-stocked single-flip via listing.updateMany.
        await prisma.listingCardItem.updateMany({
          where: { shippingBundleId: result.id },
          data: { status: "AVAILABLE", buyerId: null, soldAt: null, shippingBundleId: null },
        });
        await prisma.listing.updateMany({
          where: { id: { in: listingIds }, buyerId: bp.buyerId, status: "SOLD" },
          data: { status: "ACTIVE", buyerId: null },
        });
        await prisma.shippingBundle.update({ where: { id: result.id }, data: { status: "CANCELLED" } });
        await prisma.bundleProposal.update({ where: { id: bp.id }, data: { status: "REJECTED" } });
        throw e;
      }
    } else {
      // Partial balance — listings RESERVED, paymentDeadline 5 days
      const paymentDeadline = new Date(Date.now() + BUNDLE_PAYMENT_DEADLINE_DAYS_SHIP * 24 * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        const bundle = await tx.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId: bp.buyerId,
            sellerId: bp.sellerId,
            shippingCost: shippingCostForBundle,
            totalItemCost: itemsTotalForBundle,
            totalCost: totalAmount,
            status: "PENDING",
            shippingMethodId: acceptedShippingMethodId,
            paymentMode: "PLATFORM",
            deliveryMethod: bp.deliveryMethod,
            bundleProposalId: bp.id,
            buyerStreet: buyer.street,
            buyerHouseNumber: buyer.houseNumber,
            buyerPostalCode: buyer.postalCode,
            buyerCity: buyer.city,
            buyerCountry: buyer.country,
            bundleListings: {
              create: bp.listings.map((bl) => ({
                listingId: bl.listingId,
                priceSnapshot: bl.priceSnapshot ?? bl.listing.price ?? 0,
              })),
            },
          },
        });

        await flipBundleListingItems(tx, bp.listings as BundleListingEntry[], "RESERVED", bp.buyerId, bundle.id);

        await tx.bundleProposal.update({
          where: { id: bp.id },
          data: {
            status: "ACCEPTED",
            paymentStatus: "AWAITING_PAYMENT",
            paymentDeadline,
            respondedAt: new Date(),
          },
        });
      });
    }
  } else {
    // EXTERNAL (PICKUP off-platform) — geen wallet-impact, geen address-eis
    const reservationExpiresAt = new Date(Date.now() + PICKUP_RESERVATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const bundle = await tx.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: bp.buyerId,
          sellerId: bp.sellerId,
          shippingCost: 0,
          totalItemCost: totalAmount,
          totalCost: totalAmount,
          // EXTERNAL pickup: geen escrow, geen commissie — totalItemCost = totalAmount klopt
          // (er is geen shipping-pad). Commissie wordt sowieso niet geheven want
          // releaseEscrow wordt nooit aangeroepen voor EXTERNAL bundles.
          status: "PENDING",
          paymentMode: "EXTERNAL",
          deliveryMethod: "PICKUP",
          bundleProposalId: bp.id,
          pickupReservationExpiresAt: reservationExpiresAt,
          bundleListings: {
            create: bp.listings.map((bl) => ({
              listingId: bl.listingId,
              priceSnapshot: bl.priceSnapshot ?? bl.listing.price ?? 0,
            })),
          },
        },
      });

      await flipBundleListingItems(tx, bp.listings as BundleListingEntry[], "RESERVED", bp.buyerId, bundle.id);

      await tx.bundleProposal.update({
        where: { id: bp.id },
        data: {
          status: "ACCEPTED",
          paymentStatus: "EXTERNAL",
          pickupReservationExpiresAt: reservationExpiresAt,
          respondedAt: new Date(),
        },
      });
    });
  }

  await prisma.message.create({
    data: {
      conversationId: bp.conversationId,
      senderId: session.user.id,
      body: `Bundel-voorstel geaccepteerd. ${bp.paymentMode === "EXTERNAL" ? "Plan een ophaalmoment in." : ""}`,
      bundleProposalId: bp.id,
    },
  });

  await createNotification(
    bp.buyerId,
    "ITEM_SOLD",
    "Bundel-voorstel geaccepteerd",
    bp.paymentMode === "EXTERNAL"
      ? `Je bundel-voorstel is geaccepteerd. Plan een ophaalmoment via de chat.`
      : `Je bundel-voorstel van €${totalAmount.toFixed(2)} is geaccepteerd.`,
    `/nl/berichten/${bp.conversationId}`
  );

  await publishNewMessageForConversation(
    bp.conversationId,
    session.user.id,
    `✅ Bundel-voorstel geaccepteerd (€${totalAmount.toFixed(2)})`,
  );

  return { success: true };
}

// Buyer betaalt het restant van een AWAITING_PAYMENT bundle-offer (PLATFORM
// only). Promotie van PENDING bundle naar PAID + listings RESERVED → SOLD.
export async function completeBundleOfferPayment(bundleProposalId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const bp = await prisma.bundleProposal.findUnique({
    where: { id: bundleProposalId },
    include: {
      listings: { select: { listingId: true } },
      shippingBundle: { select: { id: true, status: true } },
    },
  });
  if (!bp) return { error: "Voorstel niet gevonden" };
  if (bp.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (bp.status !== "ACCEPTED" || bp.paymentStatus !== "AWAITING_PAYMENT") {
    return { error: "Voorstel staat niet in AWAITING_PAYMENT-status" };
  }
  if (bp.paymentMode !== "PLATFORM") return { error: "Niet-platform-bundles vereisen geen betaling" };
  if (!bp.shippingBundle || bp.shippingBundle.status !== "PENDING") {
    return { error: "Onverwachte bundle-status" };
  }
  if (bp.paymentDeadline && bp.paymentDeadline < new Date()) {
    return { error: "Betalingstermijn is verlopen" };
  }

  const buyer = await prisma.user.findUnique({ where: { id: bp.buyerId } });
  if (!buyer) return { error: "Koper niet gevonden" };
  const availableBalance = buyer.balance - buyer.reservedBalance;
  if (availableBalance < bp.totalAmount) {
    return { error: `Onvoldoende saldo. Benodigd: €${bp.totalAmount.toFixed(2)}` };
  }

  const listingIds = bp.listings.map((bl) => bl.listingId);

  // Atomic: items + listings RESERVED → SOLD + bundle PENDING → PAID.
  // Race-protectie (Fase 27.79): cron `bundle-offer-payment-deadline` kan
  // tussen onze checks en deze tx gelopen hebben en alles teruggezet hebben
  // naar ACTIVE. Telt items + listings die we daadwerkelijk geflipt hebben;
  // als beide nul zijn én er waren entries, gooit een error en aborteert
  // de tx → geen wallet-mutatie achteraf.
  await prisma.$transaction(async (tx) => {
    const itemsFlipped = await tx.listingCardItem.updateMany({
      where: { shippingBundleId: bp.shippingBundle!.id, status: "RESERVED" },
      data: { status: "SOLD", soldAt: new Date() },
    });
    const listingsFlipped = await tx.listing.updateMany({
      where: { id: { in: listingIds }, status: "RESERVED" },
      data: { status: "SOLD", buyerId: bp.buyerId },
    });
    if (itemsFlipped.count === 0 && listingsFlipped.count === 0) {
      throw new Error("Reservering is verlopen — vraag de verkoper een nieuw voorstel te accepteren.");
    }
    const bundleFlipped = await tx.shippingBundle.updateMany({
      where: { id: bp.shippingBundle!.id, status: "PENDING" },
      data: { status: "PAID" },
    });
    if (bundleFlipped.count === 0) {
      throw new Error("Bestelling is intussen geannuleerd of betaald.");
    }
    await tx.bundleProposal.update({
      where: { id: bp.id },
      data: { paymentStatus: "PAID" },
    });
  });

  try {
    await deductBalance(bp.buyerId, bp.totalAmount, "PURCHASE", `Bundel-aankoop (${listingIds.length} advertenties)`);
    await escrowCredit(bp.sellerId, bp.totalAmount, `Bundel-verkoop (escrow, ${listingIds.length} advertenties)`, bp.shippingBundle!.id);
  } catch (e) {
    // Rollback
    await prisma.listingCardItem.updateMany({
      where: { shippingBundleId: bp.shippingBundle!.id, status: "SOLD" },
      data: { status: "RESERVED", soldAt: null },
    });
    await prisma.listing.updateMany({
      where: { id: { in: listingIds }, status: "SOLD", buyerId: bp.buyerId },
      data: { status: "RESERVED", buyerId: null },
    });
    await prisma.shippingBundle.update({ where: { id: bp.shippingBundle!.id }, data: { status: "PENDING" } });
    await prisma.bundleProposal.update({ where: { id: bp.id }, data: { paymentStatus: "AWAITING_PAYMENT" } });
    throw e;
  }

  await createNotification(
    bp.sellerId,
    "ORDER_PAID",
    "Bundel betaald",
    `De koper heeft de openstaande bundel van €${bp.totalAmount.toFixed(2)} voltooid.`,
    "/dashboard/verkopen"
  );

  await publishNewMessageForConversation(
    bp.conversationId,
    session.user.id,
    `💸 Bundel-betaling voltooid (€${bp.totalAmount.toFixed(2)})`,
  );

  return { success: true };
}

// Read-only helper voor de bundle-offer modal: alle ACTIVE listings van een
// seller die de buyer mag zien (na blocking-filter).
export async function getRecentSellerListingsForBuyer(sellerId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd", listings: [] as never[] };

  const blocked = await getBlockedUserIds(session.user.id);
  if (blocked.has(sellerId)) return { error: "Niet beschikbaar", listings: [] as never[] };

  const listings = await prisma.listing.findMany({
    where: { sellerId, status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      imageUrls: true,
      price: true,
      pricingType: true,
      deliveryMethod: true,
      allowPlatformPickup: true,
      allowExternalPickup: true,
      shippingMethods: { select: { shippingMethodId: true, price: true } },
      // Voor de details-mini-popup in bundle-offer-form (Fase 27.65)
      listingType: true,
      condition: true,
      cardName: true,
      description: true,
      // Voor stocked-quantity stepper + MULTI_CARD partial items-picker (Fase 27.66)
      allowPartialSale: true,
      cardItemRows: {
        where: { status: "AVAILABLE" },
        select: { id: true, cardName: true, condition: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { success: true, listings };
}

