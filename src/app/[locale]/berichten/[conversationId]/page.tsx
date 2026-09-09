import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProfileTitle } from "@/lib/user-name";
import { getSellerShippingMethods } from "@/actions/shipping-method";
import { getTranslations } from "next-intl/server";
import { getConversationPreviews } from "@/lib/conversations";
import { ChatLayout } from "@/components/message/chat-layout";
import { MessagesFrame } from "@/components/message/messages-frame";
import { MessageThread } from "@/components/message/message-thread";
import { ChatActions } from "@/components/message/chat-actions";
import { PickupActions } from "@/components/message/pickup-actions";
import { ChatAvatar } from "@/components/message/chat-avatar";
import { MapPin, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

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

  const t = await getTranslations("chat");
  const previews = await getConversationPreviews(session.user.id!, { activeConversationId: conversationId });

  // Get active conversation with messages, listing context, and proposals
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, firstName: true, lastName: true, accountKind: true, companyName: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { displayName: true, firstName: true, lastName: true, accountKind: true, companyName: true } } },
      },
      auction: { select: { title: true } },
      claimsale: { select: { title: true } },
      listing: { select: { id: true, title: true, price: true, shippingCost: true, status: true, sellerId: true, listingType: true, allowPartialSale: true } },
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
    shippingCost: conversation.listing.shippingCost,
    status: conversation.listing.status,
    sellerId: conversation.listing.sellerId,
    listingType: conversation.listing.listingType,
    allowPartialSale: conversation.listing.allowPartialSale,
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
      requestInsuredShipping: bp.requestInsuredShipping,
      status: bp.status,
      paymentStatus: bp.paymentStatus,
      paymentDeadline: bp.paymentDeadline?.toISOString() ?? null,
      pickupReservationExpiresAt: bp.pickupReservationExpiresAt?.toISOString() ?? null,
      expiresAt: bp.expiresAt?.toISOString() ?? null,
      listings: bp.listings.map((bpl) => {
        const imgs = parseImageUrls(bpl.listing.imageUrls);
        let itemCount = 0;
        if (bpl.itemIds) {
          try {
            const arr = JSON.parse(bpl.itemIds);
            if (Array.isArray(arr)) itemCount = arr.length;
          } catch {
            // ignore
          }
        }
        return {
          listingId: bpl.listingId,
          title: bpl.listing.title,
          imageUrl: imgs[0] ?? null,
          priceSnapshot: bpl.priceSnapshot,
          quantity: bpl.quantity,
          itemCount,
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

  // Current user's eigen seller-shipping-methods voor de seller-accept-modal
  // op een bundle-offer (Fase 27.10). Pas relevant als current user de seller
  // van een binnenkomende offer is.
  const otherUserId = otherUser?.userId ?? null;
  const currentUserSellerShippingMethods = (await getSellerShippingMethods()).map((m) => ({
    id: m.id,
    carrier: m.carrier,
    service: m.service,
    zone: m.zone,
    effectivePrice: m.effectivePrice,
  }));

  // Fase 27.48: actieve single-listing pickup-bundle voor deze conversation —
  // niet via bundle-proposal maar via directe buyListing met PICKUP_PLATFORM
  // of PICKUP_EXTERNAL. Tonen we als sticky widget bovenaan de chat-thread.
  // Voor stocked-pickup is bundle.listingId null (stocked-buys gebruiken
  // cardItems-relatie); we matchen dan via cardItems[*].listingId.
  const conversationListingId = conversation.listing?.id ?? null;
  const activePickupBundle = conversationListingId && otherUserId
    ? await prisma.shippingBundle.findFirst({
        where: {
          deliveryMethod: "PICKUP",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          OR: [
            { buyerId: session.user.id!, sellerId: otherUserId },
            { buyerId: otherUserId, sellerId: session.user.id! },
          ],
          AND: {
            OR: [
              { listingId: conversationListingId },
              { cardItems: { some: { listingId: conversationListingId } } },
            ],
          },
        },
        include: { pickupSchedule: true },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const pickupWidgetData = activePickupBundle
    ? {
        shippingBundleId: activePickupBundle.id,
        bundleStatus: activePickupBundle.status,
        paymentMode: activePickupBundle.paymentMode,
        buyerId: activePickupBundle.buyerId,
        sellerId: activePickupBundle.sellerId,
        schedule: activePickupBundle.pickupSchedule
          ? {
              id: activePickupBundle.pickupSchedule.id,
              proposedById: activePickupBundle.pickupSchedule.proposedById,
              proposedFor: activePickupBundle.pickupSchedule.proposedFor.toISOString(),
              windowStart: activePickupBundle.pickupSchedule.windowStart,
              windowEnd: activePickupBundle.pickupSchedule.windowEnd,
              status: activePickupBundle.pickupSchedule.status,
              // Code alleen aan buyer tonen — seller voert in (PLATFORM) of
              // ziet 'm helemaal niet (EXTERNAL met 1-knops confirm).
              pickupCode: session.user!.id === activePickupBundle.buyerId
                ? activePickupBundle.pickupSchedule.pickupCode
                : null,
              pickupCodeAttempts: activePickupBundle.pickupSchedule.pickupCodeAttempts,
              pickupLockedUntil: activePickupBundle.pickupSchedule.pickupLockedUntil?.toISOString() ?? null,
            }
          : null,
      }
    : null;

  const ctxLabel = contextType === "auction" ? t("ctxAuction") : contextType === "claimsale" ? t("ctxClaimsale") : contextType === "listing" ? t("ctxListing") : null;
  const otherName = otherUser ? getProfileTitle(otherUser.user) : t("conversation");
  const otherHandle = otherUser ? `@${otherUser.user.displayName}` : null;
  const otherAvatar = previews.find((c) => c.id === conversationId)?.otherUserAvatar ?? null;

  return (
    <MessagesFrame>
    <ChatLayout conversations={previews} activeConversationId={conversationId}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Gespreks-kop: terugknop (mobiel), avatar, naam, context-pill, acties */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 md:px-4">
          <Link
            href="/berichten"
            aria-label={t("backToConversations")}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <ChatAvatar src={otherAvatar} initial={otherName.charAt(0).toUpperCase()} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 items-baseline gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{otherName}</span>
              {otherHandle && <span className="shrink-0 text-xs font-normal text-muted-foreground">{otherHandle}</span>}
            </h2>
            {context && (
              <p className="truncate text-xs text-muted-foreground">
                {ctxLabel && <span className="font-medium">{ctxLabel}</span>}
                {ctxLabel && " · "}
                {context}
              </p>
            )}
          </div>
          <ChatActions
            conversationId={conversationId}
            status={previews.find((c) => c.id === conversationId)?.participantStatus ?? "ACTIVE"}
          />
        </div>

        {/* Pickup-bundle widget (Fase 27.48) — sticky bovenaan voor single-listing
            pickup-bundles. Voor bundle-offer pickups blijft PickupActions in de
            BundleOfferMessage chat-bubble. */}
        {pickupWidgetData && (
          <div className="border-b border-border bg-primary/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="size-4 text-primary" />
              {t("pickupWidgetTitle")}
            </div>
            <PickupActions
              shippingBundleId={pickupWidgetData.shippingBundleId}
              bundleStatus={pickupWidgetData.bundleStatus}
              paymentMode={pickupWidgetData.paymentMode}
              schedule={pickupWidgetData.schedule}
              currentUserId={session.user.id!}
              buyerId={pickupWidgetData.buyerId}
              sellerId={pickupWidgetData.sellerId}
            />
          </div>
        )}

        {/* Messages + input */}
        <div className="min-h-0 flex-1">
          <MessageThread
            conversationId={conversationId}
            messages={conversation.messages.map((m) => ({
              id: m.id,
              body: m.body,
              imageUrl: m.imageUrl,
              senderName: getProfileTitle(m.sender),
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
            currentUserSellerShippingMethods={currentUserSellerShippingMethods}
            contextType={contextType}
            availableBalance={availableBalance}
          />
        </div>
      </div>
    </ChatLayout>
    </MessagesFrame>
  );
}
