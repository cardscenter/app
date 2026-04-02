import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PurchasesContent } from "@/components/dashboard/purchases-content";

export default async function MyPurchasesPage() {
  const session = await auth();
  const t = await getTranslations("purchases");
  const userId = session!.user!.id!;

  const bundles = await prisma.shippingBundle.findMany({
    where: {
      buyerId: userId,
      status: { not: "PENDING" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { id: true, displayName: true } },
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
        },
      },
      auction: {
        select: { id: true, title: true, imageUrls: true, finalPrice: true },
      },
      listing: {
        select: { id: true, title: true, imageUrls: true, price: true },
      },
    },
  });

  const serialized = bundles.map((b) => ({
    id: b.id,
    orderNumber: b.orderNumber,
    sellerName: b.seller.displayName,
    sellerId: b.seller.id,
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
    items: b.items.map((i) => ({
      id: i.id,
      cardName: i.cardName,
      condition: i.condition,
      price: i.price,
      imageUrl: (() => {
        try { const urls = JSON.parse(i.imageUrls); return urls[0] ?? null; } catch { return null; }
      })(),
      reference: i.reference ?? null,
      sellerNote: null, // Private: only visible to seller
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      {serialized.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noPurchases")}
        </p>
      ) : (
        <PurchasesContent bundles={serialized} />
      )}
    </div>
  );
}
