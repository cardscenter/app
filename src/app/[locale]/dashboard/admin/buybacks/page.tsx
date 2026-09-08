import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackList } from "@/components/buyback/admin-buyback-list";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function AdminBuybackPage() {
  const t = await getTranslations("buyback");

  const requests = await prisma.buybackRequest.findMany({
    include: {
      user: { select: { displayName: true, email: true } },
      items: true,
      bulkItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("adminTitle")} />
      <AdminBuybackList requests={JSON.parse(JSON.stringify(requests))} />
    </div>
  );
}
