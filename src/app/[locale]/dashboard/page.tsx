import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { DashboardEssentials } from "@/components/dashboard/home/dashboard-essentials";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
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

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      accountType: true,
      totpEnabled: true,
    },
  });

  if (!user) return null;

  const hasPremium = user.accountType !== "FREE";

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

      {/* Actie-nodig is bewust het eerste en meest prominente blok (Fase 44-
          feedback) — de quick-stats-rij is vervallen, de nav dekt die routes. */}
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
