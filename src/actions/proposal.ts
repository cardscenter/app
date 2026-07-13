"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { publishNewMessageForConversation } from "@/actions/message";
import { generateOrderNumber } from "@/lib/order-number";
import { createPendingBundle } from "@/lib/shipping-bundle";
import { requireNotSuspended } from "@/lib/suspension";
import { requireEmailVerified } from "@/lib/email-verification";

// Helper: bereken nieuwe listing-status na een items-status-flip.
// SOLD als geen items meer AVAILABLE/RESERVED, anders PARTIALLY_SOLD.
async function recomputeListingStatusAfterPartialSale(
  tx: Prisma.TransactionClient,
  listingId: string
) {
  const remaining = await tx.listingCardItem.count({
    where: { listingId, status: { in: ["AVAILABLE", "RESERVED"] } },
  });
  await tx.listing.update({
    where: { id: listingId },
    data: { status: remaining === 0 ? "SOLD" : "PARTIALLY_SOLD" },
  });
}

// Buyer maakt een partial-sale-aanvraag op een listing met allowPartialSale=true.
// Implementatie hergebruikt het Proposal-model: itemIds-veld onderscheidt
// partial van full-listing proposals.
// Read-only helper voor de partial-sale-modal: alle AVAILABLE items van een
// listing die de buyer mag zien. Listing moet allowPartialSale=true hebben.
export async function getListingItemsForPartialSale(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd", items: [] as never[], allowPartialSale: false };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { allowPartialSale: true, status: true, listingType: true },
  });
  if (!listing) return { error: "Advertentie niet gevonden", items: [] as never[], allowPartialSale: false };
  if (!listing.allowPartialSale) return { error: "Geen gedeeltelijke verkoop", items: [] as never[], allowPartialSale: false };

  const items = await prisma.listingCardItem.findMany({
    where: { listingId, status: "AVAILABLE" },
    select: { id: true, cardName: true, condition: true, quantity: true, cardSetId: true, tcgdexId: true },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, items, allowPartialSale: true };
}

export async function createPartialSaleProposal(input: {
  conversationId: string;
  listingId: string;
  itemIds: string[];
  totalAmount: number;
  requestInsuredShipping?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // Fase 43 — voorstellen doen vereist een bevestigd e-mailadres.
  const verified = await requireEmailVerified(session.user.id);
  if ("error" in verified) return { error: verified.error };

  if (input.totalAmount <= 0) return { error: "Bedrag moet groter zijn dan 0" };
  if (!input.itemIds || input.itemIds.length === 0) return { error: "Selecteer minimaal één item" };

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: { participants: true },
  });
  if (!conversation) return { error: "Gesprek niet gevonden" };
  const isParticipant = conversation.participants.some((p) => p.userId === session.user!.id);
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, sellerId: true, status: true, allowPartialSale: true, listingType: true, title: true },
  });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (!listing.allowPartialSale) return { error: "Deze advertentie staat geen gedeeltelijke verkoop toe" };
  if (listing.listingType !== "MULTI_CARD") return { error: "Gedeeltelijke verkoop is alleen mogelijk bij multi-card advertenties" };
  if (listing.status !== "ACTIVE" && listing.status !== "PARTIALLY_SOLD") {
    return { error: "Advertentie is niet meer beschikbaar" };
  }
  if (listing.sellerId === session.user.id) return { error: "Je kunt geen voorstel doen op je eigen advertentie" };

  // Items moeten van deze listing zijn én AVAILABLE
  const items = await prisma.listingCardItem.findMany({
    where: { id: { in: input.itemIds }, listingId: input.listingId },
    select: { id: true, status: true, cardName: true },
  });
  if (items.length !== input.itemIds.length) return { error: "Eén of meer items niet gevonden" };
  for (const it of items) {
    if (it.status !== "AVAILABLE") return { error: `"${it.cardName}" is niet meer beschikbaar` };
  }

  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!buyer) return { error: "Koper niet gevonden" };

  // Maximaal één PENDING (partial of full) per (conversation, proposer)
  const existingPending = await prisma.proposal.findFirst({
    where: { conversationId: input.conversationId, proposerId: session.user.id, status: "PENDING" },
  });
  if (existingPending) return { error: "Er staat al een openstaand voorstel — trek dat eerst in." };

  const created = await prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        conversationId: input.conversationId,
        listingId: input.listingId,
        proposerId: session.user!.id,
        amount: input.totalAmount,
        type: "BUY",
        status: "PENDING",
        itemIds: JSON.stringify(input.itemIds),
        requestInsuredShipping: input.requestInsuredShipping ?? false,
      },
    });
    await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: session.user!.id,
        body: `Gedeeltelijke verkoop: ${items.length} item(s) voor €${input.totalAmount.toFixed(2)} (incl. verzending).`,
        proposalId: proposal.id,
      },
    });
    return proposal;
  });

  await createNotification(
    listing.sellerId,
    "NEW_MESSAGE",
    "Gedeeltelijke verkoop voorgesteld",
    `Een koper biedt €${input.totalAmount.toFixed(2)} voor ${items.length} item(s) uit "${listing.title}".`,
    `/nl/berichten/${input.conversationId}`
  );

  return { success: true, proposalId: created.id };
}

export async function createProposal(
  conversationId: string,
  amount: number,
  type: "BUY" | "SELL"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // Fase 43 — voorstellen doen vereist een bevestigd e-mailadres.
  const verified = await requireEmailVerified(session.user.id);
  if ("error" in verified) return { error: verified.error };

  if (amount <= 0) return { error: "Bedrag moet groter zijn dan 0" };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
      listing: { select: { id: true, title: true, status: true, sellerId: true, price: true } },
    },
  });

  if (!conversation) return { error: "Gesprek niet gevonden" };

  // Verify user is participant
  const isParticipant = conversation.participants.some((p) => p.userId === session.user!.id);
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  // If listing context: validate seller/buyer roles
  if (conversation.listing) {
    if (conversation.listing.status !== "ACTIVE") return { error: "Deze advertentie is niet meer beschikbaar" };
    const isSeller = conversation.listing.sellerId === session.user.id;
    if (type === "BUY" && isSeller) return { error: "Als verkoper kun je alleen een verkoopvoorstel doen" };
    if (type === "SELL" && !isSeller) return { error: "Als koper kun je alleen een koopvoorstel doen" };
  }

  // Check no pending proposal exists in this conversation
  const existingPending = await prisma.proposal.findFirst({
    where: {
      conversationId,
      status: "PENDING",
    },
  });
  if (existingPending) return { error: "Er is al een openstaand betaalverzoek in dit gesprek" };

  const proposal = await prisma.proposal.create({
    data: {
      listingId: conversation.listing?.id,
      conversationId,
      proposerId: session.user.id,
      amount: Math.round(amount * 100) / 100,
      type,
      status: "PENDING",
    },
  });

  // Create system message referencing the proposal
  await prisma.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      body: "",
      proposalId: proposal.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Notify the other party
  const otherUserId = conversation.participants.find((p) => p.userId !== session.user!.id)?.userId;
  const contextTitle = conversation.listing?.title ?? "Betaalverzoek";
  if (otherUserId) {
    await createNotification(
      otherUserId,
      "NEW_MESSAGE",
      type === "BUY" ? "Nieuw koopvoorstel" : "Nieuw verkoopvoorstel",
      `Voorstel van €${amount.toFixed(2)} voor "${contextTitle}"`,
      `/nl/berichten/${conversationId}`
    );
  }

  await publishNewMessageForConversation(
    conversationId,
    session.user.id,
    `${type === "BUY" ? "💶 Koopvoorstel" : "💶 Verkoopvoorstel"}: €${amount.toFixed(2)}`,
  );

  return { success: true, proposalId: proposal.id };
}

export async function getProposalBalanceInfo(proposalId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      listing: { select: { shippingCost: true } },
      conversation: { include: { participants: true } },
    },
  });

  if (!proposal) return { error: "Niet gevonden" };

  // Determine buyer
  const isBuyProposal = proposal.type === "BUY";
  const buyerId = isBuyProposal
    ? proposal.proposerId
    : proposal.conversation.participants.find((p) => p.userId !== proposal.proposerId)?.userId;

  if (!buyerId) return { error: "Koper niet gevonden" };

  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { balance: true, reservedBalance: true },
  });
  if (!buyer) return { error: "Koper niet gevonden" };

  const shippingCost = proposal.listing?.shippingCost ?? 0;
  const totalCost = proposal.amount + shippingCost;
  const availableBalance = buyer.balance - buyer.reservedBalance;
  const hasSufficientBalance = availableBalance >= totalCost;

  return {
    totalCost,
    shippingCost,
    availableBalance,
    hasSufficientBalance,
    buyerId,
  };
}

export async function respondToProposal(
  proposalId: string,
  action: "ACCEPT" | "REJECT"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // Fase 43 — ACCEPT gaat een nieuwe koopverplichting aan en vereist een
  // bevestigd e-mailadres; REJECT moet altijd kunnen (deal niet kunstmatig
  // open houden).
  if (action === "ACCEPT") {
    const verified = await requireEmailVerified(session.user.id);
    if ("error" in verified) return { error: verified.error };
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      listing: {
        include: { shippingMethods: true },
      },
      conversation: {
        include: { participants: true },
      },
    },
  });

  if (!proposal) return { error: "Voorstel niet gevonden" };
  if (proposal.status !== "PENDING") return { error: "Dit voorstel is al beantwoord" };
  if (proposal.proposerId === session.user.id) return { error: "Je kunt je eigen voorstel niet beantwoorden" };

  const isParticipant = proposal.conversation.participants.some((p) => p.userId === session.user!.id);
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  if (action === "REJECT") {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    const contextTitle = proposal.listing?.title ?? "betaalverzoek";
    await createNotification(
      proposal.proposerId,
      "NEW_MESSAGE",
      "Voorstel afgewezen",
      `Je voorstel van €${proposal.amount.toFixed(2)} voor "${contextTitle}" is afgewezen.`,
      `/nl/berichten/${proposal.conversationId}`
    );

    await publishNewMessageForConversation(
      proposal.conversationId,
      session.user.id,
      `❌ Voorstel afgewezen (€${proposal.amount.toFixed(2)})`,
    );

    return { success: true, status: "REJECTED" };
  }

  // ACCEPT flow
  const isBuyProposal = proposal.type === "BUY";
  const buyerId = isBuyProposal ? proposal.proposerId : session.user.id;
  const sellerId = proposal.listing
    ? proposal.listing.sellerId
    : proposal.conversation.participants.find((p) => p.userId !== buyerId)?.userId;

  if (!sellerId) return { error: "Verkoper niet gevonden" };

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) return { error: "Koper niet gevonden" };

  const amount = proposal.amount;
  const shippingCost = proposal.listing?.shippingCost ?? 0;
  const totalCost = amount + shippingCost;

  const availableBalance = buyer.balance - buyer.reservedBalance;

  // For proposals WITHOUT a listing: no minimum — just accept and set deadline if needed.
  // For proposals WITH a listing: require 15% minimum (Fase 29 — was 40%, aligned met
  // auction-flow zodat we één consistente threshold hanteren voor partial-balance
  // commitments. Bij niet-betalen lift het strike-systeem mee.)
  if (proposal.listing) {
    const minimumRequired = Math.round(totalCost * 0.15 * 100) / 100;
    if (availableBalance < minimumRequired) {
      return { error: `Onvoldoende saldo. Minimaal 15% (€${minimumRequired.toFixed(2)}) is vereist.` };
    }
  }

  // Check buyer has address (only for listing-based proposals with shipping)
  if (proposal.listing && (!buyer.street || !buyer.postalCode || !buyer.city)) {
    return { error: "De koper moet eerst een adres invullen via Dashboard → Verzending" };
  }

  const contextTitle = proposal.listing?.title ?? "betaalverzoek";

  // Partial-sale (Fase 27.13): proposal.itemIds bevat een JSON-array van
  // ListingCardItem-ids. We flippen die items i.p.v. de hele listing.
  const partialItemIds: string[] | null = proposal.itemIds ? JSON.parse(proposal.itemIds) : null;
  const isPartial = !!partialItemIds && partialItemIds.length > 0 && proposal.listing;

  if (availableBalance >= totalCost) {
    // Full payment: immediate purchase
    await deductBalance(buyerId, totalCost, "PURCHASE", `Betaalverzoek: ${contextTitle}`, undefined, undefined, proposal.listing?.id);
    await escrowCredit(sellerId, totalCost, `Betaalverzoek (escrow): ${contextTitle}`);

    if (proposal.listing) {
      if (isPartial) {
        await prisma.$transaction(async (tx) => {
          const flipped = await tx.listingCardItem.updateMany({
            where: { id: { in: partialItemIds! }, status: "AVAILABLE" },
            data: { status: "SOLD", buyerId, soldAt: new Date() },
          });
          if (flipped.count !== partialItemIds!.length) {
            throw new Error("Eén of meer items zijn niet meer beschikbaar");
          }
          const bundle = await tx.shippingBundle.create({
            data: {
              orderNumber: generateOrderNumber(),
              buyerId,
              sellerId,
              shippingCost,
              totalItemCost: amount,
              totalCost,
              status: "PAID",
              // listingId blijft null — bundle.listingId is @unique en kan dus
              // maar één partial-sale per listing dragen. Items linken via
              // shippingBundleId.
              listingId: null,
              buyerStreet: buyer.street,
              buyerHouseNumber: buyer.houseNumber,
              buyerPostalCode: buyer.postalCode,
              buyerCity: buyer.city,
              buyerCountry: buyer.country,
            },
          });
          await tx.listingCardItem.updateMany({
            where: { id: { in: partialItemIds! } },
            data: { shippingBundleId: bundle.id },
          });
          await recomputeListingStatusAfterPartialSale(tx, proposal.listing!.id);
        });
      } else {
        await prisma.listing.update({
          where: { id: proposal.listing.id },
          data: { status: "SOLD", buyerId },
        });
        await prisma.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId,
            sellerId,
            shippingCost,
            totalItemCost: amount,
            totalCost,
            status: "PAID",
            listingId: proposal.listing.id,
            buyerStreet: buyer.street,
            buyerHouseNumber: buyer.houseNumber,
            buyerPostalCode: buyer.postalCode,
            buyerCity: buyer.city,
            buyerCountry: buyer.country,
          },
        });
      }
    }

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "ACCEPTED", respondedAt: new Date(), paymentStatus: "PAID" },
    });
  } else {
    // Partial/no balance: set payment deadline (5 days)
    const paymentDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: "ACCEPTED",
        respondedAt: new Date(),
        paymentStatus: "AWAITING_PAYMENT",
        paymentDeadline,
      },
    });

    if (proposal.listing) {
      if (isPartial) {
        await prisma.$transaction(async (tx) => {
          const flipped = await tx.listingCardItem.updateMany({
            where: { id: { in: partialItemIds! }, status: "AVAILABLE" },
            data: { status: "RESERVED", buyerId },
          });
          if (flipped.count !== partialItemIds!.length) {
            throw new Error("Eén of meer items zijn niet meer beschikbaar");
          }
          await recomputeListingStatusAfterPartialSale(tx, proposal.listing!.id);
        });
        // Pending bundle voor partial-sale (zonder listingId)
        await createPendingBundle({
          buyerId,
          sellerId,
          totalItemCost: amount,
          shippingCost,
          listingId: undefined,
          address: {
            street: buyer.street,
            houseNumber: buyer.houseNumber,
            postalCode: buyer.postalCode,
            city: buyer.city,
            country: buyer.country,
          },
        });
        // Note: pending-bundle ↔ items link wordt pas gelegd bij completeProposalPayment.
      } else {
        await prisma.listing.update({
          where: { id: proposal.listing.id },
          data: { status: "SOLD", buyerId },
        });
        await createPendingBundle({
          buyerId,
          sellerId,
          totalItemCost: amount,
          shippingCost,
          listingId: proposal.listing.id,
          address: {
            street: buyer.street,
            houseNumber: buyer.houseNumber,
            postalCode: buyer.postalCode,
            city: buyer.city,
            country: buyer.country,
          },
        });
      }
    }
  }

  // Notify both parties. The seller-side notification differs by payment
  // state so they don't ship before the partial-balance buyer has actually
  // paid the remainder.
  await createNotification(
    proposal.proposerId,
    "ITEM_SOLD",
    "Voorstel geaccepteerd!",
    `Het voorstel van €${amount.toFixed(2)} voor "${contextTitle}" is geaccepteerd.`,
    `/nl/berichten/${proposal.conversationId}`
  );

  if (availableBalance >= totalCost) {
    await createNotification(
      sellerId,
      "ORDER_PAID",
      "Betaalverzoek geaccepteerd!",
      `"${contextTitle}" — €${amount.toFixed(2)} is geaccepteerd. Bekijk je verkopen om te verzenden.`,
      "/dashboard/verkopen"
    );
  } else {
    await createNotification(
      sellerId,
      "ITEM_SOLD",
      "Voorstel geaccepteerd — wachten op betaling",
      `"${contextTitle}" — €${amount.toFixed(2)} is geaccepteerd, maar de koper heeft nog 5 dagen om te betalen. Verzend pas zodra de betaling binnen is.`,
      `/nl/berichten/${proposal.conversationId}`
    );
  }

  await publishNewMessageForConversation(
    proposal.conversationId,
    session.user.id,
    `✅ Voorstel geaccepteerd (€${amount.toFixed(2)})`,
  );

  return { success: true, status: "ACCEPTED" };
}

export async function completeProposalPayment(proposalId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      listing: true,
      conversation: { include: { participants: true } },
    },
  });

  if (!proposal) return { error: "Voorstel niet gevonden" };
  if (proposal.status !== "ACCEPTED" || proposal.paymentStatus !== "AWAITING_PAYMENT") {
    return { error: "Dit voorstel wacht niet op betaling" };
  }

  if (proposal.paymentDeadline && new Date() > proposal.paymentDeadline) {
    // Same correctness consideration as completeAuctionPayment: leave the
    // status mutation to the proposal-payment-deadline cron, which is the
    // single source of truth for deadline transitions and bundle cleanup.
    return { error: "De betalingsdeadline is verlopen" };
  }

  const buyerId = proposal.type === "BUY" ? proposal.proposerId :
    proposal.conversation.participants.find((p) => p.userId !== proposal.proposerId)?.userId;

  if (!buyerId || buyerId !== session.user.id) return { error: "Niet geautoriseerd" };

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  const shippingCost = proposal.listing?.shippingCost ?? 0;
  const totalCost = proposal.amount + shippingCost;
  const availableBalance = buyer.balance - buyer.reservedBalance;

  if (availableBalance < totalCost) {
    return { error: `Onvoldoende saldo. Benodigd: €${totalCost.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
  }

  const sellerId = proposal.listing
    ? proposal.listing.sellerId
    : proposal.conversation.participants.find((p) => p.userId !== buyerId)?.userId;

  if (!sellerId) return { error: "Verkoper niet gevonden" };

  const contextTitle = proposal.listing?.title ?? "betaalverzoek";

  await deductBalance(buyerId, totalCost, "PURCHASE", `Betaalverzoek: ${contextTitle}`, undefined, undefined, proposal.listing?.id);
  await escrowCredit(sellerId, totalCost, `Betaalverzoek (escrow): ${contextTitle}`);

  if (proposal.listing) {
    const partialItemIds: string[] | null = proposal.itemIds ? JSON.parse(proposal.itemIds) : null;
    const isPartial = !!partialItemIds && partialItemIds.length > 0;

    if (isPartial) {
      // Partial-sale: vind de pending bundle (listingId=null) van deze
      // (buyer, seller, AWAITING_PAYMENT-vlag) — most recent. Geen FK want
      // listingId @unique blokkeert meerdere partial-sales op één listing.
      const pending = await prisma.shippingBundle.findFirst({
        where: {
          buyerId, sellerId, status: "PENDING", listingId: null,
        },
        orderBy: { createdAt: "desc" },
      });
      await prisma.$transaction(async (tx) => {
        if (pending) {
          await tx.shippingBundle.update({
            where: { id: pending.id },
            data: {
              status: "PAID",
              buyerStreet: buyer.street,
              buyerHouseNumber: buyer.houseNumber,
              buyerPostalCode: buyer.postalCode,
              buyerCity: buyer.city,
              buyerCountry: buyer.country,
            },
          });
          await tx.listingCardItem.updateMany({
            where: { id: { in: partialItemIds! } },
            data: { status: "SOLD", soldAt: new Date(), shippingBundleId: pending.id },
          });
        } else {
          // Defensive fallback: create fresh PAID bundle + flip items
          const fresh = await tx.shippingBundle.create({
            data: {
              orderNumber: generateOrderNumber(),
              buyerId, sellerId,
              shippingCost, totalItemCost: proposal.amount, totalCost,
              status: "PAID", listingId: null,
              buyerStreet: buyer.street, buyerHouseNumber: buyer.houseNumber,
              buyerPostalCode: buyer.postalCode, buyerCity: buyer.city,
              buyerCountry: buyer.country,
            },
          });
          await tx.listingCardItem.updateMany({
            where: { id: { in: partialItemIds! } },
            data: { status: "SOLD", soldAt: new Date(), shippingBundleId: fresh.id },
          });
        }
        await recomputeListingStatusAfterPartialSale(tx, proposal.listing!.id);
      });
    } else {
      // Full-listing flow (bestaand)
      const existing = await prisma.shippingBundle.findUnique({
        where: { listingId: proposal.listing.id },
      });
      if (existing) {
        await prisma.shippingBundle.update({
          where: { id: existing.id },
          data: {
            status: "PAID",
            buyerStreet: buyer.street,
            buyerHouseNumber: buyer.houseNumber,
            buyerPostalCode: buyer.postalCode,
            buyerCity: buyer.city,
            buyerCountry: buyer.country,
          },
        });
      } else {
        await prisma.shippingBundle.create({
          data: {
            orderNumber: generateOrderNumber(),
            buyerId,
            sellerId,
            shippingCost,
            totalItemCost: proposal.amount,
            totalCost,
            status: "PAID",
            listingId: proposal.listing.id,
            buyerStreet: buyer.street,
            buyerHouseNumber: buyer.houseNumber,
            buyerPostalCode: buyer.postalCode,
            buyerCity: buyer.city,
            buyerCountry: buyer.country,
          },
        });
      }
    }
  }

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { paymentStatus: "PAID" },
  });

  await createNotification(
    sellerId,
    "ORDER_PAID",
    "Betaling ontvangen!",
    `De betaling voor "${contextTitle}" (€${totalCost.toFixed(2)}) is voltooid. Bekijk je verkopen om te verzenden.`,
    "/dashboard/verkopen"
  );

  await publishNewMessageForConversation(
    proposal.conversationId,
    session.user.id,
    `💸 Betaling voltooid (€${totalCost.toFixed(2)})`,
  );

  return { success: true };
}

export async function withdrawProposal(proposalId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      listing: { select: { title: true } },
      conversation: { include: { participants: true } },
    },
  });

  if (!proposal) return { error: "Voorstel niet gevonden" };
  if (proposal.proposerId !== session.user.id) return { error: "Je kunt alleen je eigen voorstel intrekken" };
  if (proposal.status !== "PENDING") return { error: "Dit voorstel kan niet meer worden ingetrokken" };

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "WITHDRAWN", respondedAt: new Date() },
  });

  const otherUserId = proposal.conversation.participants.find((p) => p.userId !== session.user!.id)?.userId;
  const contextTitle = proposal.listing?.title ?? "betaalverzoek";
  if (otherUserId) {
    await createNotification(
      otherUserId,
      "NEW_MESSAGE",
      "Voorstel ingetrokken",
      `Het voorstel van €${proposal.amount.toFixed(2)} voor "${contextTitle}" is ingetrokken.`,
      `/nl/berichten/${proposal.conversationId}`
    );
  }

  await publishNewMessageForConversation(
    proposal.conversationId,
    session.user.id,
    `🚫 Voorstel ingetrokken (€${proposal.amount.toFixed(2)})`,
  );

  return { success: true };
}
