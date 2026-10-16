import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackDetail } from "@/components/buyback/admin-buyback-detail";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin";
import { decryptIban } from "@/lib/iban-crypto";
import { getBulkPricing } from "@/lib/buyback-pricing-db";

export const dynamic = "force-dynamic";

export default async function AdminBuybackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const t = await getTranslations("buyback");

  const request = await prisma.buybackRequest.findUnique({
    where: { id },
    include: {
      user: { select: { displayName: true, email: true } },
      items: true,
      bulkItems: true,
      returnPayment: { select: { status: true, paidAt: true } },
    },
  });

  if (!request) notFound();
  // Fase 6: admin ziet het volledige, ontsleutelde IBAN voor de overboeking.
  const safeRequest = { ...request, iban: decryptIban(request.iban) };
  const pricing = await getBulkPricing({ includeDisabled: true });
  const categoryLabels = Object.fromEntries(pricing.map((p) => [p.key, p.name]));

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("requestDetail")}
        backHref="/dashboard/admin/buybacks"
        backLabel={t("backToOverview")}
      />
      <AdminBuybackDetail request={JSON.parse(JSON.stringify(safeRequest))} categoryLabels={categoryLabels} />
    </div>
  );
}
