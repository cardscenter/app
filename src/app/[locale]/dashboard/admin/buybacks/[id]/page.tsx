import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackDetail } from "@/components/buyback/admin-buyback-detail";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div>
      <Link
        href="/dashboard/admin/buybacks"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToOverview")}
      </Link>
      <AdminBuybackDetail request={JSON.parse(JSON.stringify(request))} />
    </div>
  );
}
