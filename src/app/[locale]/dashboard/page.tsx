import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardEssentials } from "@/components/dashboard/home/dashboard-essentials";
import {
  fetchActionItems,
  fetchBalanceOverview,
  fetchActiveActivity,
  fetchRecentBundles,
} from "@/lib/dashboard-queries";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("dashboard");
  const tw = await getTranslations("wallet");

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      balance: true,
      reservedBalance: true,
      accountType: true,
      _count: {
        select: {
          auctions: { where: { status: "ACTIVE" } },
          claimsales: { where: { status: "LIVE" } },
          listings: { where: { status: "ACTIVE" } },
          purchasedItems: true,
        },
      },
    },
  });

  if (!user) return null;

  const availableBalance = Math.max(0, user.balance - user.reservedBalance);
  const hasPremium = user.accountType !== "FREE";

  const stats = [
    { label: t("myAuctions"), value: user._count.auctions, href: "/dashboard/veilingen" },
    { label: t("myClaimsales"), value: user._count.claimsales, href: "/dashboard/claimsales" },
    { label: t("myListings"), value: user._count.listings, href: "/dashboard/marktplaats" },
    { label: t("myPurchases"), value: user._count.purchasedItems, href: "/dashboard/aankopen" },
    { label: tw("balance"), value: `€${availableBalance.toFixed(2)}`, href: "/dashboard/saldo" },
  ];

  const [actionItems, balance, activity, bundles] = await Promise.all([
    fetchActionItems(userId),
    fetchBalanceOverview(userId),
    fetchActiveActivity(userId),
    fetchRecentBundles(userId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.displayName}</p>

      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="glass rounded-2xl p-4 transition-all hover:scale-[1.02] hover:shadow-md"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-foreground">{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Essentials voor iedereen, premium-CTA alleen voor PRO/UNLIMITED */}
      <div className="mt-8">
        <DashboardEssentials
          actionItems={actionItems}
          balance={balance}
          activity={activity}
          bundles={bundles}
          showPremiumCta={hasPremium}
        />
      </div>
    </div>
  );
}
