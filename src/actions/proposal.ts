"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { checkAmountAllowed } from "@/lib/account-age";

export async function createProposal(
  conversationId: string,
  amount: number,
  type: "BUY" | "SELL"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

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

  // Account age check
  const ageCheck = checkAmountAllowed(buyer, totalCost);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  const availableBalance = buyer.balance - buyer.reservedBalance;

  // For proposals WITHOUT a listing, no 40% minimum — just accept and set deadline if needed
  // For proposals WITH a listing, require 40% minimum
  if (proposal.listing) {
    const minimumRequired = totalCost * 0.4;
    if (availableBalance < minimumRequired) {
      return { error: `Onvoldoende saldo. Minimaal 40% (€${minimumRequired.toFixed(2)}) is vereist.` };
    }
  }

  // Check buyer has address (only for listing-based proposals with shipping)
  if (proposal.listing && (!buyer.street || !buyer.postalCode || !buyer.city)) {
    return { error: "De koper moet eerst een adres invullen via Dashboard → Verzending" };
  }

  const contextTitle = proposal.listing?.title ?? "betaalverzoek";

  if (availableBalance >= totalCost) {
    // Full payment: immediate purchase
    await deductBalance(buyerId, totalCost, "PURCHASE", `Betaalverzoek: ${contextTitle}`, undefined, undefined, proposal.listing?.id);
    await escrowCredit(sellerId, totalCost, `Betaalverzoek (escrow): ${contextTitle}`);

    if (proposal.listing) {
      await prisma.listing.update({
        where: { id: proposal.listing.id },
        data: { status: "SOLD", buyerId },
      });

      await prisma.shippingBundle.create({
        data: {
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
      await prisma.listing.update({
        where: { id: proposal.listing.id },
        data: { status: "SOLD", buyerId },
      });
    }
  }

  // Notify both parties
  await createNotification(
    proposal.proposerId,
    "ITEM_SOLD",
    "Voorstel geaccepteerd!",
    `Het voorstel van €${amount.toFixed(2)} voor "${contextTitle}" is geaccepteerd.`,
    `/nl/berichten/${proposal.conversationId}`
  );

  await createNotification(
    sellerId,
    "ITEM_SOLD",
    "Betaalverzoek geaccepteerd!",
    `"${contextTitle}" — €${amount.toFixed(2)} is geaccepteerd.`,
    proposal.listing ? `/nl/marktplaats/${proposal.listing.id}` : `/nl/berichten/${proposal.conversationId}`
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
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { paymentStatus: "PAYMENT_FAILED" },
    });
    if (proposal.listing) {
      await prisma.listing.update({
        where: { id: proposal.listing.id },
        data: { status: "ACTIVE", buyerId: null },
      });
    }
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
    await prisma.shippingBundle.create({
      data: {
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

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { paymentStatus: "PAID" },
  });

  await createNotification(
    sellerId,
    "ITEM_SOLD",
    "Betaling ontvangen!",
    `De betaling voor "${contextTitle}" (€${totalCost.toFixed(2)}) is voltooid.`,
    proposal.listing ? `/nl/marktplaats/${proposal.listing.id}` : `/nl/berichten/${proposal.conversationId}`
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
    data: { status: "REJECTED", respondedAt: new Date() },
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

  return { success: true };
}
