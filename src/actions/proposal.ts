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

  // Verify conversation exists and has a listing
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: true,
      listing: { select: { id: true, title: true, status: true, sellerId: true, price: true } },
    },
  });

  if (!conversation) return { error: "Gesprek niet gevonden" };
  if (!conversation.listing) return { error: "Dit gesprek is niet gekoppeld aan een advertentie" };
  if (conversation.listing.status !== "ACTIVE") return { error: "Deze advertentie is niet meer beschikbaar" };

  // Verify user is participant
  const isParticipant = conversation.participants.some((p) => p.userId === session.user!.id);
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  // Verify correct party: buyer can only BUY, seller can only SELL
  const isSeller = conversation.listing.sellerId === session.user.id;
  if (type === "BUY" && isSeller) return { error: "Als verkoper kun je alleen een verkoopvoorstel doen" };
  if (type === "SELL" && !isSeller) return { error: "Als koper kun je alleen een koopvoorstel doen" };

  // Check no pending proposal exists
  const existingPending = await prisma.proposal.findFirst({
    where: {
      conversationId,
      listingId: conversation.listing.id,
      status: "PENDING",
    },
  });
  if (existingPending) return { error: "Er is al een openstaand voorstel voor deze advertentie" };

  // Create proposal
  const proposal = await prisma.proposal.create({
    data: {
      listingId: conversation.listing.id,
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

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Notify the other party
  const otherUserId = conversation.participants.find((p) => p.userId !== session.user!.id)?.userId;
  if (otherUserId) {
    await createNotification(
      otherUserId,
      "NEW_MESSAGE",
      type === "BUY" ? "Nieuw koopvoorstel" : "Nieuw verkoopvoorstel",
      `Voorstel van €${amount.toFixed(2)} voor "${conversation.listing.title}"`,
      `/nl/berichten/${conversationId}`
    );
  }

  return { success: true, proposalId: proposal.id };
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

  // Verify responder is the OTHER party (not the proposer)
  if (proposal.proposerId === session.user.id) return { error: "Je kunt je eigen voorstel niet beantwoorden" };

  // Verify responder is participant
  const isParticipant = proposal.conversation.participants.some((p) => p.userId === session.user!.id);
  if (!isParticipant) return { error: "Niet geautoriseerd" };

  if (action === "REJECT") {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    // Notify proposer
    await createNotification(
      proposal.proposerId,
      "NEW_MESSAGE",
      "Voorstel afgewezen",
      `Je voorstel van €${proposal.amount.toFixed(2)} voor "${proposal.listing.title}" is afgewezen.`,
      `/nl/berichten/${proposal.conversationId}`
    );

    return { success: true, status: "REJECTED" };
  }

  // ACCEPT flow
  // Determine buyer and seller
  const isBuyProposal = proposal.type === "BUY";
  const buyerId = isBuyProposal ? proposal.proposerId : session.user.id;
  const sellerId = proposal.listing.sellerId;

  // Verify listing is still active
  if (proposal.listing.status !== "ACTIVE") {
    return { error: "Deze advertentie is niet meer beschikbaar" };
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) return { error: "Koper niet gevonden" };

  const amount = proposal.amount;
  const shippingCost = proposal.listing.shippingCost;
  const totalCost = amount + shippingCost;

  // Account age check
  const ageCheck = checkAmountAllowed(buyer, totalCost);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  const availableBalance = buyer.balance - buyer.reservedBalance;
  const minimumRequired = totalCost * 0.4;

  if (availableBalance < minimumRequired) {
    return { error: `Onvoldoende saldo. Minimaal 40% (€${minimumRequired.toFixed(2)}) is vereist.` };
  }

  // Check buyer has address
  if (!buyer.street || !buyer.postalCode || !buyer.city) {
    return { error: "De koper moet eerst een adres invullen via Dashboard → Verzending" };
  }

  if (availableBalance >= totalCost) {
    // Full payment: immediate purchase
    await deductBalance(buyerId, totalCost, "PURCHASE", `Gekocht via voorstel: ${proposal.listing.title}`, undefined, undefined, proposal.listing.id);
    await escrowCredit(sellerId, totalCost, `Verkocht via voorstel (escrow): ${proposal.listing.title}`);

    // Mark listing as sold
    await prisma.listing.update({
      where: { id: proposal.listing.id },
      data: { status: "SOLD", buyerId },
    });

    // Create ShippingBundle
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

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "ACCEPTED", respondedAt: new Date(), paymentStatus: "PAID" },
    });
  } else {
    // Partial balance (>= 40%): set payment deadline (5 days)
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

    // Mark listing as sold with buyer
    await prisma.listing.update({
      where: { id: proposal.listing.id },
      data: { status: "SOLD", buyerId },
    });
  }

  // Notify both parties
  await createNotification(
    proposal.proposerId,
    "ITEM_SOLD",
    "Voorstel geaccepteerd!",
    `Het voorstel van €${amount.toFixed(2)} voor "${proposal.listing.title}" is geaccepteerd.`,
    `/nl/berichten/${proposal.conversationId}`
  );

  await createNotification(
    sellerId,
    "ITEM_SOLD",
    "Advertentie verkocht!",
    `"${proposal.listing.title}" is verkocht voor €${amount.toFixed(2)}.`,
    `/nl/marktplaats/${proposal.listing.id}`
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

  // Check deadline
  if (proposal.paymentDeadline && new Date() > proposal.paymentDeadline) {
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { paymentStatus: "PAYMENT_FAILED" },
    });
    // Re-activate listing
    await prisma.listing.update({
      where: { id: proposal.listing.id },
      data: { status: "ACTIVE", buyerId: null },
    });
    return { error: "De betalingsdeadline is verlopen" };
  }

  // Determine buyer
  const buyerId = proposal.type === "BUY" ? proposal.proposerId :
    proposal.conversation.participants.find((p) => p.userId !== proposal.proposerId)?.userId;

  if (!buyerId || buyerId !== session.user.id) return { error: "Niet geautoriseerd" };

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  const totalCost = proposal.amount + proposal.listing.shippingCost;
  const availableBalance = buyer.balance - buyer.reservedBalance;

  if (availableBalance < totalCost) {
    return { error: `Onvoldoende saldo. Benodigd: €${totalCost.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
  }

  // Complete the purchase
  await deductBalance(buyerId, totalCost, "PURCHASE", `Gekocht via voorstel: ${proposal.listing.title}`, undefined, undefined, proposal.listing.id);
  await escrowCredit(proposal.listing.sellerId, totalCost, `Verkocht via voorstel (escrow): ${proposal.listing.title}`);

  // Create ShippingBundle
  await prisma.shippingBundle.create({
    data: {
      buyerId,
      sellerId: proposal.listing.sellerId,
      shippingCost: proposal.listing.shippingCost,
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

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { paymentStatus: "PAID" },
  });

  // Notify seller
  await createNotification(
    proposal.listing.sellerId,
    "ITEM_SOLD",
    "Betaling ontvangen!",
    `De betaling voor "${proposal.listing.title}" (€${totalCost.toFixed(2)}) is voltooid.`,
    `/nl/marktplaats/${proposal.listing.id}`
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

  // Notify the other party
  const otherUserId = proposal.conversation.participants.find((p) => p.userId !== session.user!.id)?.userId;
  if (otherUserId) {
    await createNotification(
      otherUserId,
      "NEW_MESSAGE",
      "Voorstel ingetrokken",
      `Het voorstel van €${proposal.amount.toFixed(2)} voor "${proposal.listing.title}" is ingetrokken.`,
      `/nl/berichten/${proposal.conversationId}`
    );
  }

  return { success: true };
}
