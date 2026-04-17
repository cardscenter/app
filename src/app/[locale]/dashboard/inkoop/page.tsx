import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { BuybackDashboard } from "@/components/buyback/buyback-dashboard";
import { Link } from "@/i18n/navigation";
import { Plus } from "lucide-react";

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href="/verkoop-calculator"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t("createNew")}
        </Link>
      </div>
      <BuybackDashboard requests={JSON.parse(JSON.stringify(requests))} />
    </div>
  );
}
