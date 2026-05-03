import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Polling-endpoint voor live-chat (Fase 27.55). Returnt nieuwe messages
// na `since`-timestamp + de huidige pickup-schedule status zodat de chat-
// widget ook live updates ontvangt zonder full page-reload.
//
// Auth: alleen actieve participants mogen pollen.
// Performance: indexed query op (conversationId, createdAt). Lege resultset
// als er niets nieuws is — geen full thread-refetch.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  // Verify participant — voorkomt dat anderen chats kunnen pollen
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
    select: { id: true },
  });
  if (!participant) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 403 });
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);

  // Conversation met laatste pickup-schedule. Niet-relevante data wordt
  // niet opgehaald om de query klein te houden.
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      listingId: true,
      participants: { select: { userId: true } },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  // Nieuwe messages na `since` — kleine resultset, indexed query.
  const newMessages = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { sender: { select: { displayName: true } } },
  });

  // Pickup-bundle state voor sticky widget (snelheid: skipt als er geen
  // listing-context is op de conversation).
  const otherUserId = conversation.participants
    .map((p) => p.userId)
    .find((id) => id !== session.user!.id) ?? null;
  let pickupState: {
    bundleId: string;
    bundleStatus: string;
    paymentMode: string;
    deliveryMethod: string;
    scheduleStatus: string | null;
    proposedById: string | null;
    proposedFor: string | null;
    windowStart: string | null;
    windowEnd: string | null;
  } | null = null;
  if (conversation.listingId && otherUserId) {
    const bundle = await prisma.shippingBundle.findFirst({
      where: {
        deliveryMethod: "PICKUP",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        OR: [
          { buyerId: session.user.id, sellerId: otherUserId },
          { buyerId: otherUserId, sellerId: session.user.id },
        ],
        AND: {
          OR: [
            { listingId: conversation.listingId },
            { cardItems: { some: { listingId: conversation.listingId } } },
          ],
        },
      },
      select: {
        id: true,
        status: true,
        paymentMode: true,
        deliveryMethod: true,
        pickupSchedule: {
          select: {
            status: true,
            proposedById: true,
            proposedFor: true,
            windowStart: true,
            windowEnd: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (bundle) {
      pickupState = {
        bundleId: bundle.id,
        bundleStatus: bundle.status,
        paymentMode: bundle.paymentMode,
        deliveryMethod: bundle.deliveryMethod,
        scheduleStatus: bundle.pickupSchedule?.status ?? null,
        proposedById: bundle.pickupSchedule?.proposedById ?? null,
        proposedFor: bundle.pickupSchedule?.proposedFor.toISOString() ?? null,
        windowStart: bundle.pickupSchedule?.windowStart ?? null,
        windowEnd: bundle.pickupSchedule?.windowEnd ?? null,
      };
    }
  }

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    messages: newMessages.map((m) => ({
      id: m.id,
      body: m.body,
      imageUrl: m.imageUrl,
      senderName: m.sender.displayName,
      senderId: m.senderId,
      createdAt: m.createdAt.toISOString(),
      proposalId: m.proposalId,
      bundleProposalId: m.bundleProposalId,
    })),
    pickupState,
  });
}
