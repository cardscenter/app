import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatLayout, type ConversationPreview } from "@/components/message/chat-layout";
import { MessageThread } from "@/components/message/message-thread";
import { ChatActions } from "@/components/message/chat-actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; conversationId: string }>;
}) {
  const { locale, conversationId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  // Verify participant
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id! },
  });
  if (!participant) notFound();

  // Mark as read
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  // Get all conversations for sidebar
  const allConversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id! } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { title: true } },
    },
  });

  const previews: ConversationPreview[] = allConversations.map((conv) => {
    const myP = conv.participants.find((p) => p.userId === session.user!.id);
    const otherUser = conv.participants.find((p) => p.userId !== session.user!.id);
    const lastMsg = conv.messages[0];
    const lastRead = myP?.lastReadAt;
    const hasUnread = conv.id === conversationId
      ? false
      : !!(lastMsg && (!lastRead || new Date(lastMsg.createdAt) > new Date(lastRead)));

    const context = conv.auction?.title ?? conv.claimsale?.title ?? conv.listing?.title ?? null;
    const contextType = conv.auction ? "auction" as const : conv.claimsale ? "claimsale" as const : conv.listing ? "listing" as const : null;

    return {
      id: conv.id,
      otherUserName: otherUser?.user.displayName ?? "Gebruiker",
      otherUserInitial: (otherUser?.user.displayName ?? "?").charAt(0).toUpperCase(),
      lastMessage: lastMsg?.body ?? null,
      lastMessageDate: lastMsg
        ? new Date(lastMsg.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
        : null,
      context,
      contextType,
      hasUnread,
      participantStatus: myP?.status ?? "ACTIVE",
    };
  });

  // Get active conversation with messages, listing context, and proposals
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { displayName: true } } },
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { id: true, title: true, price: true, status: true, sellerId: true } },
      proposals: {
        orderBy: { createdAt: "desc" },
      },
      bundleProposals: {
        orderBy: { createdAt: "desc" },
        include: {
          listings: {
            include: {
              listing: { select: { id: true, title: true, imageUrls: true } },
            },
          },
          shippingBundle: {
            include: { pickupSchedule: true },
          },
        },
      },
    },
  });

  if (!conversation) notFound();

  const otherUser = conversation.participants.find((p) => p.userId !== session.user!.id);
  const context = conversation.auction?.title ?? conversation.claimsale?.title ?? conversation.listing?.title;

  // Get user balance for proposal system
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { balance: true, reservedBalance: true },
  });
  const availableBalance = currentUser
    ? currentUser.balance - currentUser.reservedBalance
    : 0;

  // Build listing context for proposal system
  const listingContext = conversation.listing ? {
    id: conversation.listing.id,
    title: conversation.listing.title,
    price: conversation.listing.price,
    status: conversation.listing.status,
    sellerId: conversation.listing.sellerId,
  } : null;

  // Determine conversation context type
  const contextType = conversation.auction ? "auction" as const
    : conversation.claimsale ? "claimsale" as const
    : conversation.listing ? "listing" as const
    : null;

  // Build proposals map
  const proposals = conversation.proposals.map((p) => ({
    id: p.id,
    amount: p.amount,
    type: p.type,
    status: p.status,
    proposerId: p.proposerId,
    paymentStatus: p.paymentStatus,
    paymentDeadline: p.paymentDeadline?.toISOString() ?? null,
  }));

  // Bundle-proposals (Fase 27)
  const { parseImageUrls } = await import("@/lib/upload");
  const bundleProposals = conversation.bundleProposals.map((bp) => {
    // Buyer mag de pickupCode zien; seller niet (die voert hem in tijdens ophaal).
    const isBuyer = session.user!.id === bp.buyerId;
    const sched = bp.shippingBundle?.pickupSchedule ?? null;
    return {
      id: bp.id,
      buyerId: bp.buyerId,
      sellerId: bp.sellerId,
      totalAmount: bp.totalAmount,
      deliveryMethod: bp.deliveryMethod,
      paymentMode: bp.paymentMode,
      status: bp.status,
      paymentStatus: bp.paymentStatus,
      paymentDeadline: bp.paymentDeadline?.toISOString() ?? null,
      pickupReservationExpiresAt: bp.pickupReservationExpiresAt?.toISOString() ?? null,
      expiresAt: bp.expiresAt?.toISOString() ?? null,
      listings: bp.listings.map((bpl) => {
        const imgs = parseImageUrls(bpl.listing.imageUrls);
        return {
          listingId: bpl.listingId,
          title: bpl.listing.title,
          imageUrl: imgs[0] ?? null,
          priceSnapshot: bpl.priceSnapshot,
        };
      }),
      shippingBundleId: bp.shippingBundle?.id ?? null,
      bundleStatus: bp.shippingBundle?.status ?? null,
      pickupSchedule: sched
        ? {
            id: sched.id,
            proposedById: sched.proposedById,
            proposedFor: sched.proposedFor.toISOString(),
            windowStart: sched.windowStart,
            windowEnd: sched.windowEnd,
            status: sched.status,
            pickupCode: isBuyer ? sched.pickupCode : null,
            pickupCodeAttempts: sched.pickupCodeAttempts,
            pickupLockedUntil: sched.pickupLockedUntil?.toISOString() ?? null,
          }
        : null,
    };
  });

  // Seller shipping-methods voor de bundle-offer-form (alleen relevant als buyer
  // chat heeft met een seller — de "andere" partij). We laden van de
  // tegenpartij; als die geen sellerShippingMethods heeft is array leeg.
  const otherUserId = otherUser?.userId ?? null;
  const sellerShippingMethods = otherUserId
    ? await prisma.sellerShippingMethod.findMany({
        where: { sellerId: otherUserId, isActive: true },
        select: { id: true, carrier: true, serviceName: true, price: true },
      })
    : [];

  return (
    <ChatLayout conversations={previews} activeConversationId={conversationId}>
      <div className="flex h-full flex-col">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/20">
          <div>
            <h2 className="font-semibold text-foreground">
              {otherUser?.user.displayName ?? "Gesprek"}
            </h2>
            {context && (
              <p className="text-xs text-muted-foreground">Re: {context}</p>
            )}
          </div>
          <ChatActions
            conversationId={conversationId}
            status={previews.find((c) => c.id === conversationId)?.participantStatus ?? "ACTIVE"}
          />
        </div>

        {/* Messages + input */}
        <div className="flex-1 overflow-hidden">
          <MessageThread
            conversationId={conversationId}
            messages={conversation.messages.map((m) => ({
              id: m.id,
              body: m.body,
              imageUrl: m.imageUrl,
              senderName: m.sender.displayName,
              senderId: m.senderId,
              createdAt: m.createdAt.toISOString(),
              proposalId: m.proposalId,
              bundleProposalId: m.bundleProposalId,
            }))}
            currentUserId={session.user.id!}
            listingContext={listingContext}
            proposals={proposals}
            bundleProposals={bundleProposals}
            otherUserId={otherUserId}
            sellerShippingMethods={sellerShippingMethods}
            contextType={contextType}
            availableBalance={availableBalance}
          />
        </div>
      </div>
    </ChatLayout>
  );
}
