import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { SalesContent } from "@/components/dashboard/sales-content";

export default async function MySalesPage() {
  const session = await auth();
  const t = await getTranslations("sales");

  const bundles = await prisma.shippingBundle.findMany({
    where: {
      sellerId: session!.user!.id!,
      status: { not: "PENDING" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { id: true, displayName: true } },
      shippingMethod: { select: { carrier: true, serviceName: true } },
      items: {
        select: {
          id: true,
          cardName: true,
          condition: true,
          price: true,
          imageUrls: true,
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

  const serialized = bundles.map((b) => ({
    id: b.id,
    buyerName: b.buyer.displayName,
    buyerId: b.buyer.id,
    status: b.status,
    shippingCost: b.shippingCost,
    totalItemCost: b.totalItemCost,
    totalCost: b.totalCost,
    shippingMethodCarrier: b.shippingMethod?.carrier ?? null,
    shippingMethodService: b.shippingMethod?.serviceName ?? null,
    trackingUrl: b.trackingUrl,
    shippedAt: b.shippedAt?.toISOString() ?? null,
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
    disputeInfo: b.dispute ? { id: b.dispute.id, status: b.dispute.status, reason: b.dispute.reason } : null,
    items: b.items.map((i) => ({
      id: i.id,
      cardName: i.cardName,
      condition: i.condition,
      price: i.price,
      imageUrl: (() => {
        try { const urls = JSON.parse(i.imageUrls); return urls[0] ?? null; } catch { return null; }
      })(),
    })),
  }));

  // Summary stats
  const completedBundles = serialized.filter((b) => b.status === "COMPLETED");
  const stats = {
    totalRevenue: completedBundles.reduce((sum, b) => sum + b.totalCost, 0),
    itemsSold: completedBundles.reduce((sum, b) => sum + b.items.length, 0) +
      completedBundles.filter((b) => b.sourceType !== "claimsale").length,
    pendingShipments: serialized.filter((b) => b.status === "PAID").length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      {serialized.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noSales")}
        </p>
      ) : (
        <SalesContent bundles={serialized} stats={stats} />
      )}
    </div>
  );
}
