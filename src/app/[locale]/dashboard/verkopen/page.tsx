import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SalesContent } from "@/components/dashboard/sales-content";
import { CancellationsSection } from "@/components/dashboard/cancellations-section";

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
      dispute: {
        select: { id: true, status: true, reason: true },
      },
    },
  });

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
    shippingCost: b.shippingCost,
    totalItemCost: b.totalItemCost,
    totalCost: b.totalCost,
    shippingMethodCarrier: b.shippingMethod?.carrier ?? null,
    shippingMethodService: b.shippingMethod?.serviceName ?? null,
    shippingMethodIsTracked: b.shippingMethod?.isTracked ?? true,
    trackingUrl: b.trackingUrl,
    shippedAt: b.shippedAt?.toISOString() ?? null,
    refundedAmount: b.refundedAmount ?? 0,
    createdAt: b.createdAt.toISOString(),
    sourceType: b.auctionId ? "auction" as const : b.listingId ? "listing" as const : "claimsale" as const,
    sourceTitle: b.auction?.title ?? b.listing?.title ?? null,
    sourceImageUrl: (() => {
      const raw = b.auction?.imageUrls ?? b.listing?.imageUrls ?? null;
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
    items: b.items.map((i) => ({
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
          <CancellationsSection
            currentUserId={userId}
            paidBundles={serialized
              .filter((b) => b.status === "PAID")
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
