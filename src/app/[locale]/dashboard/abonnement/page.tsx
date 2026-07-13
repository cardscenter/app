import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getTierConfig } from "@/lib/subscription-tiers";
import { TierGrid } from "@/components/subscription/tier-grid";
import { CurrentSubscriptionCard } from "@/components/subscription/current-subscription-card";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const t = await getTranslations("subscription");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, premiumExpiresAt: true },
  });
  if (!user) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "CANCELLED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tier: true,
      billingCycle: true,
      status: true,
      paymentStatus: true,
      startsAt: true,
      expiresAt: true,
      cancelledAt: true,
      gracePeriodEnd: true,
    },
  });

  const pendingEnterpriseRequest = await prisma.enterpriseRequest.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true },
  });

  const currentTier = getTierConfig(user.accountType);
  const isAdmin = user.accountType === "ADMIN";

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("title")} subtitle={t("headerSubtitle")} />

      <CurrentSubscriptionCard
        accountType={user.accountType}
        isAdmin={isAdmin}
        tierName={isAdmin ? "Admin (Enterprise)" : t(currentTier.nameKey)}
        currentCommissionPct={(currentTier.commissionRate * 100).toFixed(1)}
        subscription={subscription}
      />

      <TierGrid
        currentAccountType={user.accountType}
        hasPendingEnterpriseRequest={!!pendingEnterpriseRequest}
      />
    </div>
  );
}
