import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BuybackDashboard } from "@/components/buyback/buyback-dashboard";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { buttonVariants } from "@/components/ui/button";

export default async function DashboardInkoopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/auth/login", locale });
    return null;
  }

  const t = await getTranslations("buyback");

  const requests = await prisma.buybackRequest.findMany({
    where: { userId: session.user.id },
    include: { items: true, bulkItems: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("title")}
        action={
          <Link href="/verkoop-calculator" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> {t("createNew")}
          </Link>
        }
      />
      <BuybackDashboard requests={JSON.parse(JSON.stringify(requests))} />
    </div>
  );
}
