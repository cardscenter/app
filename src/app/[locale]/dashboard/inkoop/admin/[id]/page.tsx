import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AdminBuybackDetail } from "@/components/buyback/admin-buyback-detail";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function AdminBuybackDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });

  if (user?.accountType !== "ADMIN") {
    redirect({ href: "/dashboard", locale });
    return null;
  }

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
        href="/dashboard/inkoop/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToOverview")}
      </Link>
      <AdminBuybackDetail request={JSON.parse(JSON.stringify(request))} />
    </div>
  );
}
