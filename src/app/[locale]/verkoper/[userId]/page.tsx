import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { isUserBlocked } from "@/actions/block-report";
import { getSellerProfileData } from "@/lib/seller-profile-data";
import { PageContainer } from "@/components/layout/page-container";
import { SellerProfileHeader } from "@/components/seller/seller-profile-header";
import { SellerStatRow } from "@/components/seller/seller-stat-row";
import { SellerHistoryTabs } from "@/components/seller/seller-history-tabs";
import { ReviewsTable, ActiveOffersTable, RecentSalesTable } from "@/components/seller/seller-history-tables";

/**
 * Publiek verkopersprofiel (Fase 45-redesign): breadcrumb → header-kaart
 * (identiteit + feiten-grid) → stat-rij → "Geschiedenis" met tabs
 * Reviews · Actief aanbod · Recente verkopen (alleen eigenaar).
 */
export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const t = await getTranslations("sellerProfile");
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const profile = await getSellerProfileData(userId, viewerId);
  if (!profile) {
    return (
      <PageContainer width="default" className="py-8">
        <p className="text-center text-muted-foreground">{t("sellerNotFound")}</p>
      </PageContainer>
    );
  }

  const isOwner = viewerId === userId;
  const isLoggedIn = !!viewerId;
  const initiallyBlocked = !isOwner && isLoggedIn ? await isUserBlocked(userId) : false;

  const tabs = [
    { key: "reviews", label: t("tabReviews"), count: profile.reviews.length, content: <ReviewsTable reviews={profile.reviews} /> },
    { key: "offers", label: t("tabOffers"), count: profile.activeOffers.length, content: <ActiveOffersTable offers={profile.activeOffers} /> },
    ...(profile.recentSales
      ? [{ key: "sales", label: t("tabSales"), count: profile.recentSales.length, content: <RecentSalesTable sales={profile.recentSales} /> }]
      : []),
  ];

  return (
    <PageContainer width="default" className="py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span>{t("breadcrumbSellers")}</span>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{profile.user.displayName}</span>
      </nav>

      <div className="space-y-6">
        <SellerProfileHeader
          profile={profile}
          isOwner={isOwner}
          viewerLoggedIn={isLoggedIn}
          initiallyBlocked={initiallyBlocked}
          variant="profile"
        />

        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground">{t("currentStats")}</h2>
          <SellerStatRow profile={profile} />
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-foreground">{t("history")}</h2>
          <SellerHistoryTabs tabs={tabs} />
        </div>
      </div>
    </PageContainer>
  );
}
