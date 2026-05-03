import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SalesContent } from "@/components/dashboard/sales-content";
import { CancellationsSection } from "@/components/dashboard/cancellations-section";
import { ActivePickupsSection } from "@/components/dashboard/active-pickups-section";

// Idem als in /aankopen: groepeer items met dezelfde cardName + conditie
// tot één rij met aantal + subtotaal.
type RawItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  reference: string | null;
  sellerNote: string | null;
  refundedAt: string | null;
};
function groupBundleItems(items: RawItem[]) {
  const groups = new Map<string, RawItem & { quantity: number; subtotal: number }>();
  for (const it of items) {
    const key = `${it.cardName}|${it.condition}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal += it.price;
    } else {
      groups.set(key, { ...it, quantity: 1, subtotal: it.price });
    }
  }
  return Array.from(groups.values());
}

export default async function MySalesPage() {
  const session = await auth();
  const t = await getTranslations("sales");
  const userId = session!.user!.id!;

  // Fetch shipping bundles (all statuses except PENDING)
  const bundles = await prisma.shippingBundle.findMany({
    where: {
      sellerId: userId,
      status: { not: "PENDING" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { id: true, displayName: true, firstName: true, lastName: true } },
      shippingMethod: { select: { carrier: true, serviceName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cardName: true,
          condition: true,
          price: true,
          imageUrls: true,
          reference: true,
          sellerNote: true,
          refundedAt: true,
        },
      },
      auction: {
        select: { id: true, title: true, imageUrls: true, finalPrice: true, condition: true },
      },
      listing: {
        select: { id: true, title: true, imageUrls: true, price: true, condition: true, listingType: true },
      },
      bundleListings: {
        include: {
          listing: { select: { id: true, title: true, imageUrls: true, condition: true } },
        },
      },
      cardItems: {
        include: {
          listing: { select: { id: true, title: true, imageUrls: true, price: true } },
        },
      },
      cancellationRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
      dispute: {
        select: { id: true, status: true, reason: true },
      },
      pickupSchedule: {
        select: {
          status: true,
          pickupCode: true,
          proposedFor: true,
          windowStart: true,
          windowEnd: true,
        },
      },
      bundleProposal: { select: { conversationId: true } },
    },
  });

  // Bestaande listing-conversations voor pickup-bundles zoeken zodat seller
  // direct naar de chat met de buyer kan navigeren (anders zou de knop
  // "noConversationSeller" tonen — seller kan zelf geen nieuwe chat maken).
  const sellerPickupListingIds = bundles
    .filter((b) => b.deliveryMethod === "PICKUP")
    .map((b) => b.listingId ?? b.cardItems[0]?.listingId ?? null)
    .filter((id): id is string => id !== null);
  const sellerPickupConversations = sellerPickupListingIds.length > 0
    ? await prisma.conversation.findMany({
        where: {
          listingId: { in: sellerPickupListingIds },
          participants: { some: { userId } },
        },
        select: { id: true, listingId: true },
      })
    : [];
  const sellerConvByListing = new Map(sellerPickupConversations.map((c) => [c.listingId!, c.id]));

  // Pickup-bundles voor seller-perspectief — zelfde sectie als bij aankopen.
  // Seller ziet ophaal-afspraken die nog openstaan en kan via chat-knop snel
  // naar het gesprek navigeren. Code-confirm voor PLATFORM gebeurt in chat-bubble.
  const sellerActivePickups = bundles
    .filter((b) => {
      if (b.deliveryMethod !== "PICKUP") return false;
      if (b.status === "COMPLETED" || b.status === "CANCELLED") return false;
      if (b.status === "PAID" && b.paymentMode === "PLATFORM" && !b.pickupSchedule) return true;
      if (b.status === "SCHEDULED") return true;
      if (b.status === "PENDING" && b.paymentMode === "EXTERNAL") return true;
      return false;
    })
    .map((b) => ({
      id: b.id,
      orderNumber: b.orderNumber,
      counterpartyName: b.buyer.displayName,
      counterpartyId: b.buyer.id,
      pickupCode: b.pickupSchedule?.pickupCode ?? null,
      proposedFor: b.pickupSchedule?.proposedFor?.toISOString() ?? null,
      windowStart: b.pickupSchedule?.windowStart ?? null,
      windowEnd: b.pickupSchedule?.windowEnd ?? null,
      paymentMode: b.paymentMode,
      scheduleStatus: b.pickupSchedule?.status ?? null,
      conversationId: b.bundleProposal?.conversationId
        ?? sellerConvByListing.get(b.listingId ?? b.cardItems[0]?.listingId ?? "")
        ?? null,
      listingId: b.listingId ?? b.cardItems[0]?.listingId ?? null,
      perspective: "seller" as const,
    }));

  // Fetch auctions awaiting payment (buyer won but hasn't fully paid)
  const awaitingPaymentAuctions = await prisma.auction.findMany({
    where: {
      sellerId: userId,
      paymentStatus: "AWAITING_PAYMENT",
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch winner display names for awaiting payment auctions
  const winnerIds = awaitingPaymentAuctions
    .map((a) => a.winnerId)
    .filter((id): id is string => id !== null);
  const winners = winnerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const winnerMap = new Map(winners.map((w) => [w.id, w.displayName]));

  const serialized = bundles.map((b) => ({
    id: b.id,
    orderNumber: b.orderNumber,
    buyerName: b.buyer.displayName,
    buyerId: b.buyer.id,
    status: b.status,
    hasActiveCancellation: b.cancellationRequests.length > 0,
    shippingCost: b.shippingCost,
    totalItemCost: b.totalItemCost,
    totalCost: b.totalCost,
    shippingMethodCarrier: b.shippingMethod?.carrier ?? null,
    shippingMethodService: b.shippingMethod?.serviceName ?? null,
    shippingMethodIsTracked: b.shippingMethod?.isTracked ?? true,
    deliveryMethod: b.deliveryMethod,
    trackingUrl: b.trackingUrl,
    shippedAt: b.shippedAt?.toISOString() ?? null,
    refundedAmount: b.refundedAmount ?? 0,
    createdAt: b.createdAt.toISOString(),
    sourceType: b.auctionId
      ? "auction" as const
      : (b.listingId || b.bundleListings.length > 0 || b.cardItems.length > 0)
        ? "listing" as const
        : "claimsale" as const,
    // Titel: directe listing > auction > bundle-offer-titel >
    // listing afgeleid uit eerste cardItem (stocked-buy/partial-sale).
    sourceTitle: b.auction?.title
      ?? b.listing?.title
      ?? (b.bundleListings.length > 0 ? `Bundel: ${b.bundleListings.length} advertenties` : null)
      ?? b.cardItems[0]?.listing?.title
      ?? null,
    sourceImageUrl: (() => {
      const raw = b.auction?.imageUrls
        ?? b.listing?.imageUrls
        ?? b.bundleListings[0]?.listing?.imageUrls
        ?? b.cardItems[0]?.listing?.imageUrls
        ?? null;
      if (!raw) return null;
      try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
    })(),
    buyerStreet: b.buyerStreet,
    buyerHouseNumber: b.buyerHouseNumber,
    buyerPostalCode: b.buyerPostalCode,
    buyerCity: b.buyerCity,
    buyerCountry: b.buyerCountry,
    buyerFirstName: b.buyer.firstName ?? null,
    buyerLastName: b.buyer.lastName ?? null,
    disputeInfo: b.dispute ? { id: b.dispute.id, status: b.dispute.status, reason: b.dispute.reason } : null,
    // Items: claimsale-items (legacy) + ListingCardItem-rijen (stocked-buy
    // en partial-sale, Fase 27.13/27.23). Beide naar dezelfde shape, en
    // identieke rijen gegroepeerd per (cardName + conditie) met aantal +
    // subtotaal — 5× boosters wordt één rij i.p.v. vijf herhalingen.
    items: groupBundleItems([
      ...b.items.map((i) => ({
        id: i.id,
        cardName: i.cardName,
        condition: i.condition,
        price: i.price,
        imageUrl: (() => {
          try { const urls = JSON.parse(i.imageUrls); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: i.reference ?? null,
        sellerNote: i.sellerNote ?? null,
        refundedAt: i.refundedAt?.toISOString() ?? null,
      })),
      ...b.cardItems.map((ci) => ({
        id: ci.id,
        cardName: ci.cardName,
        condition: ci.condition ?? "",
        price: ci.listing?.price ?? 0,
        imageUrl: (() => {
          const raw = ci.listing?.imageUrls;
          if (!raw) return null;
          try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: null,
        sellerNote: null,
        refundedAt: null,
      })),
      // Multi-listing bundle (Fase 27.38): elke listing in de bundle als
      // eigen item-rij. Titel = listing.title, prijs = priceSnapshot
      // (vastgelegd op moment van bundle-accept). Hiermee zien koper én
      // verkoper precies welke advertenties in de bundel zaten i.p.v.
      // alleen "Bundel: N advertenties".
      ...b.bundleListings.map((bl) => ({
        id: bl.id,
        cardName: bl.listing.title,
        condition: bl.listing.condition ?? "",
        price: bl.priceSnapshot,
        imageUrl: (() => {
          const raw = bl.listing.imageUrls;
          if (!raw) return null;
          try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: null,
        sellerNote: null,
        refundedAt: null,
      })),
    ]),
  }));

  const pendingAuctions = awaitingPaymentAuctions.map((a) => ({
    id: a.id,
    title: a.title,
    imageUrl: (() => {
      if (!a.imageUrls) return null;
      try { const urls = JSON.parse(a.imageUrls); return urls[0] ?? null; } catch { return null; }
    })(),
    finalPrice: a.finalPrice ?? 0,
    buyerName: a.winnerId ? (winnerMap.get(a.winnerId) ?? "Onbekend") : "Onbekend",
    buyerId: a.winnerId ?? "",
    paymentDeadline: a.paymentDeadline?.toISOString() ?? null,
    createdAt: a.updatedAt.toISOString(),
  }));

  // Summary stats
  const completedBundles = serialized.filter((b) => b.status === "COMPLETED");
  const stats = {
    totalRevenue: completedBundles.reduce((sum, b) => sum + b.totalCost, 0),
    itemsSold: completedBundles.reduce((sum, b) => sum + b.items.length, 0) +
      completedBundles.filter((b) => b.sourceType !== "claimsale").length,
    pendingShipments: serialized.filter((b) => b.status === "PAID").length,
  };

  const hasContent = serialized.length > 0 || pendingAuctions.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      {!hasContent ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noSales")}
        </p>
      ) : (
        <>
          <ActivePickupsSection pickups={sellerActivePickups} />
          <CancellationsSection
            currentUserId={userId}
            paidBundles={serialized
              // Alleen bundles met een actief PENDING annuleringsverzoek —
              // anders zou alle PAID-verkopen hier dubbel verschijnen.
              .filter((b) => b.status === "PAID" && b.hasActiveCancellation)
              .map((b) => ({
                id: b.id,
                orderNumber: b.orderNumber,
                status: b.status,
                totalCost: b.totalCost,
                counterpartyName: b.buyerName,
              }))}
          />
          <SalesContent bundles={serialized} stats={stats} pendingAuctions={pendingAuctions} />
        </>
      )}
    </div>
  );
}
