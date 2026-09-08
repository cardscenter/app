import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackDetail } from "@/components/buyback/admin-buyback-detail";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { notFound } from "next/navigation";

export default async function AdminBuybackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("buyback");

  const request = await prisma.buybackRequest.findUnique({
    where: { id },
    include: {
      user: { select: { displayName: true, email: true } },
      items: true,
      bulkItems: true,
    },
  });

  if (!request) notFound();

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("requestDetail")}
        backHref="/dashboard/admin/buybacks"
        backLabel={t("backToOverview")}
      />
      <AdminBuybackDetail request={JSON.parse(JSON.stringify(request))} />
    </div>
  );
}
