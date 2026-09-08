import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DisputesOverview } from "@/components/dashboard/disputes-overview";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { RealtimePageRefresh } from "@/components/providers/realtime-page-refresh";

export default async function DisputesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("disputes");
  const userId = session.user.id;

  const disputes = await prisma.disputeV2.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { displayName: true } },
      seller: { select: { displayName: true } },
      bundle: { select: { orderNumber: true, totalCost: true, refundedAmount: true } },
    },
  });

  const serialized = disputes.map((d) => ({
    id: d.id,
    orderNumber: d.bundle.orderNumber,
    reasonCategory: d.reasonCategory,
    status: d.status,
    resolution: d.resolution,
    finalRefund: d.finalRefund,
    proposedRefund: d.proposedRefund,
    proposedByMe: d.proposedById === userId,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    responseDeadline: d.responseDeadline.toISOString(),
    reviewDeadline: d.buyerReviewDeadline?.toISOString() ?? null,
    adminSLADeadline: d.adminSLADeadline?.toISOString() ?? null,
    isBuyer: d.buyerId === userId,
    otherPartyName: d.buyerId === userId ? d.seller.displayName : d.buyer.displayName,
    totalCost: d.bundle.totalCost,
  }));

  return (
    <div className="space-y-6">
      <RealtimePageRefresh events={["dispute-changed"]} />
      <DashboardPageHeader title={t("title")} subtitle={t("overviewSubtitle")} />
      <DisputesOverview disputes={serialized} />
    </div>
  );
}
