"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNotSuspended } from "@/lib/suspension";
import { checkAmountAllowed } from "@/lib/account-age";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { generateOrderNumber } from "@/lib/order-number";
import { getBlockedUserIds } from "@/lib/blocking";
import { createBundleOfferSchema, acceptBundleOfferShippingSchema } from "@/lib/validations/bundle-offer";
import {
  BUNDLE_OFFER_EXPIRY_DAYS,
  BUNDLE_PAYMENT_DEADLINE_DAYS_SHIP,
  PICKUP_RESERVATION_DAYS,
} from "@/lib/bundle-offer-config";
import { requiresSignedShipping } from "@/lib/shipping/tracked-threshold";

interface CreateBundleOfferInput {
  conversationId: string;
  listingIds: string[];
  totalAmount: number;
  // Fase 27.43: 3-way keuze (SHIP / PICKUP_PLATFORM / PICKUP_EXTERNAL).
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

  // Listings ophalen + valideren
  const listings = await prisma.listing.findMany({
    where: { id: { in: data.listingIds } },
    select: {
      id: true,
      sellerId: true,
      status: true,
      title: true,
      price: true,
      deliveryMethod: true,
      allowPlatformPickup: true,
      allowExternalPickup: true,
    },
  });
  if (listings.length !== data.listingIds.length) {
    return { error: "Eén of meer advertenties niet gevonden" };
  }
  const wantsPickup = data.deliveryChoice !== "SHIP";
  const wantsPlatformPickup = data.deliveryChoice === "PICKUP_PLATFORM";
  const wantsExternalPickup = data.deliveryChoice === "PICKUP_EXTERNAL";
  for (const l of listings) {
    if (l.sellerId !== sellerId) return { error: "Alle advertenties moeten van dezelfde verkoper zijn" };
    if (l.status !== "ACTIVE") return { error: `"${l.title}" is niet meer beschikbaar` };
    if (wantsPickup && l.deliveryMethod !== "PICKUP" && l.deliveryMethod !== "BOTH") {
      return { error: `"${l.title}" ondersteunt geen ophalen` };
    }
    if (wantsPlatformPickup && !l.allowPlatformPickup) {
      return { error: `"${l.title}" accepteert geen wallet-betaling voor ophalen` };
    }
    if (wantsExternalPickup && !l.allowExternalPickup) {
      return { error: `"${l.title}" accepteert geen Tikkie/contant — kies wallet-vooraf` };
    }
  }
  // Geen shippingMethodId-validatie meer bij offer-creation. Seller kiest die
  // bij accept; server forceert isSigned als requestInsuredShipping=true of
  // wanneer requiresSignedShipping(totalAmount, isInternational) true is.

  // Account-age cap voor de buyer (relevant voor PLATFORM-flows waar geld
  // van wallet weggaat; voor EXTERNAL geen platform-saldo nodig).
  const isPlatformFlow = data.deliveryChoice === "SHIP" || data.deliveryChoice === "PICKUP_PLATFORM";
  if (isPlatformFlow) {
    const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) return { error: "Koper niet gevonden" };
    const ageCheck = checkAmountAllowed(buyer, data.totalAmount);
    if (!ageCheck.allowed) return { error: ageCheck.error! };
  }

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
          create: listings.map((l) => ({ listingId: l.id, priceSnapshot: l.price ?? null })),
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
  if (bp.buyerId !== session.user.id) return { error: "Niet geautoriseerd" };
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

  return { success: true };
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
  if (bp.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
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
  if (bp.paymentMode === "PLATFORM" && bp.deliveryMethod === "SHIP") {
    const parsed = acceptBundleOfferShippingSchema.safeParse({ bundleProposalId, shippingMethodId });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (!parsed.data.shippingMethodId) return { error: "Kies een verzendmethode om de bundel te accepteren" };

    const method = await prisma.sellerShippingMethod.findFirst({
      where: { id: parsed.data.shippingMethodId, sellerId: bp.sellerId, isActive: true },
      select: { id: true, isTracked: true, isSigned: true, shippingType: true },
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
  }

  if (bp.paymentMode === "PLATFORM") {
    if (!buyer.street || !buyer.postalCode || !buyer.city) {
      return { error: "Koper heeft nog geen adres ingevuld" };
    }

    const availableBalance = buyer.balance - buyer.reservedBalance;
    const isFullPayment = availableBalance >= totalAmount;

    if (isFullPayment) {
      // Full payment — atomic flip + escrow + bundle PAID
      const result = await prisma.$transaction(async (tx) => {
        const flipped = await tx.listing.updateMany({
          where: { id: { in: listingIds }, status: "ACTIVE" },
          data: { status: "SOLD", buyerId: bp.buyerId },
        });
        if (flipped.count !== listingIds.length) {
          throw new Error("Eén of meer advertenties zijn niet meer beschikbaar");
        }

        const bundle = await tx.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId: bp.buyerId,
            sellerId: bp.sellerId,
            shippingCost: 0, // bundle gebruikt totalAmount; aparte shipping-split is informatief
            totalItemCost: totalAmount,
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

        await tx.bundleProposal.update({
          where: { id: bp.id },
          data: { status: "ACCEPTED", paymentStatus: "PAID", respondedAt: new Date() },
        });

        return bundle;
      });

      // Wallet-mutaties buiten de tx (deductBalance/escrowCredit zijn zelf
      // transacties); mismatch zou enkel optreden als saldo intussen wegtrekt.
      try {
        await deductBalance(bp.buyerId, totalAmount, "PURCHASE", `Bundel-aankoop (${listingIds.length} advertenties)`, undefined, undefined, undefined);
        await escrowCredit(bp.sellerId, totalAmount, `Bundel-verkoop (escrow, ${listingIds.length} advertenties)`, result.id);
      } catch (e) {
        // Rollback: listings terug ACTIVE, bundle CANCELLED, offer REJECTED
        await prisma.listing.updateMany({
          where: { id: { in: listingIds }, status: "SOLD", buyerId: bp.buyerId },
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
        const flipped = await tx.listing.updateMany({
          where: { id: { in: listingIds }, status: "ACTIVE" },
          data: { status: "RESERVED" },
        });
        if (flipped.count !== listingIds.length) {
          throw new Error("Eén of meer advertenties zijn niet meer beschikbaar");
        }

        await tx.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId: bp.buyerId,
            sellerId: bp.sellerId,
            shippingCost: 0,
            totalItemCost: totalAmount,
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
      const flipped = await tx.listing.updateMany({
        where: { id: { in: listingIds }, status: "ACTIVE" },
        data: { status: "RESERVED" },
      });
      if (flipped.count !== listingIds.length) {
        throw new Error("Eén of meer advertenties zijn niet meer beschikbaar");
      }

      await tx.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: bp.buyerId,
          sellerId: bp.sellerId,
          shippingCost: 0,
          totalItemCost: totalAmount,
          totalCost: totalAmount,
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

  // Atomic: listings RESERVED → SOLD + bundle PENDING → PAID + offer paymentStatus PAID
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.listing.updateMany({
      where: { id: { in: listingIds }, status: "RESERVED" },
      data: { status: "SOLD", buyerId: bp.buyerId },
    });
    if (flipped.count !== listingIds.length) {
      throw new Error("Reservering is verlopen of gewijzigd");
    }

    await tx.shippingBundle.updateMany({
      where: { id: bp.shippingBundle!.id, status: "PENDING" },
      data: { status: "PAID" },
    });

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
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { success: true, listings };
}

