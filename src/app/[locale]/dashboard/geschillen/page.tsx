import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { DisputesOverview } from "@/components/dashboard/disputes-overview";

export default async function DisputesPage() {
  const session = await auth();
  const t = await getTranslations("disputes");
  const userId = session!.user!.id!;

  const disputes = await prisma.dispute.findMany({
    where: {
      OR: [
        { openedById: userId },
        { shippingBundle: { sellerId: userId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      shippingBundle: {
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          totalCost: true,
          totalItemCost: true,
          trackingUrl: true,
          buyer: { select: { displayName: true } },
          seller: { select: { displayName: true } },
        },
      },
    },
  });

  const serialized = disputes.map((d) => ({
    id: d.id,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution,
    partialRefundAmount: d.partialRefundAmount,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    responseDeadline: d.responseDeadline.toISOString(),
    buyerReviewDeadline: d.buyerReviewDeadline?.toISOString() ?? null,
    isBuyer: d.openedById === userId,
    otherPartyName: d.openedById === userId
      ? d.shippingBundle.seller.displayName
      : d.shippingBundle.buyer.displayName,
    totalCost: d.shippingBundle.totalCost,
    hasTracking: !!d.shippingBundle.trackingUrl,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <DisputesOverview disputes={serialized} />
    </div>
  );
}
