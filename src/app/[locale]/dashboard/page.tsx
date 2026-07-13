import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Gavel, Tag, Store, ShoppingBag, Wallet } from "lucide-react";
import { DashboardEssentials } from "@/components/dashboard/home/dashboard-essentials";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { StatCard } from "@/components/dashboard/ui/stat-card";
import { formatCurrency } from "@/lib/format";
import {
  fetchActionItems,
  fetchBalanceOverview,
  fetchActiveActivity,
  fetchRecentBundles,
} from "@/lib/dashboard-queries";
import { hasValidShippingAddress } from "@/lib/address-validation";

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
      totpEnabled: true,
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
    { label: t("myAuctions"), value: user._count.auctions, href: "/dashboard/veilingen", icon: Gavel },
    { label: t("myClaimsales"), value: user._count.claimsales, href: "/dashboard/claimsales", icon: Tag },
    { label: t("myListings"), value: user._count.listings, href: "/dashboard/marktplaats", icon: Store },
    { label: t("myPurchases"), value: user._count.purchasedItems, href: "/dashboard/aankopen", icon: ShoppingBag },
    { label: tw("balance"), value: formatCurrency(availableBalance), href: "/dashboard/saldo", icon: Wallet },
  ];

  const [actionItems, balance, activity, bundles, hasShippingAddress] = await Promise.all([
    fetchActionItems(userId),
    fetchBalanceOverview(userId),
    fetchActiveActivity(userId),
    fetchRecentBundles(userId),
    hasValidShippingAddress(userId),
  ]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} subtitle={user.displayName} />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <StatCard
            key={stat.href}
            label={stat.label}
            value={stat.value}
            href={stat.href}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Essentials voor iedereen, premium-CTA alleen voor PRO/UNLIMITED */}
      <DashboardEssentials
        actionItems={actionItems}
        balance={balance}
        activity={activity}
        bundles={bundles}
        showPremiumCta={hasPremium}
        totpEnabled={user.totpEnabled}
        hasShippingAddress={hasShippingAddress}
      />
    </div>
  );
}
