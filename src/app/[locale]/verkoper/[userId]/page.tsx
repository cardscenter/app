import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { isUserBlocked } from "@/actions/block-report";
import { getSellerProfileData } from "@/lib/seller-profile-data";
import { getProfileTitle } from "@/lib/user-name";
import { PageContainer } from "@/components/layout/page-container";
import { SellerProfileHeader } from "@/components/seller/seller-profile-header";
import { SellerHistoryTabs } from "@/components/seller/seller-history-tabs";
import { ProfileOfferGrid } from "@/components/seller/profile-offer-grid";
import { SellerAboutPanel } from "@/components/seller/seller-about-panel";
import { SellerTeamBlock } from "@/components/seller/seller-team-block";
import { ReviewsTable, RecentSalesTable } from "@/components/seller/seller-history-tables";
import { getFeatureSnapshot } from "@/lib/feature-flags";

type Params = Promise<{ locale: string; userId: string }>;

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getSellerProfileData(userId, null);
  if (!profile) return {};
  const title = getProfileTitle(profile.user);
  return {
    title: `${title} (@${profile.user.displayName}) — Cards Center`,
    description: profile.user.bio ?? undefined,
  };
}

/**
 * Publiek profiel (redesign sept 2026, naar de Portfolia-referentie):
 * omslag + grote avatar met afgeronde hoeken, volledige naam (@handle
 * eronder), Volgen + Bericht sturen, zegels + tellers rechts; daaronder
 * onderstreepte tabs Aanbod · Reviews · Over (· Verkopen voor de eigenaar)
 * en, voor bedrijfspagina's, een apart Team-blok.
 */
export default async function SellerProfilePage({ params }: { params: Params }) {
  const { locale, userId } = await params;
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
  const title = getProfileTitle(profile.user);

  // Feature-flags (Community Hub, Fase 1): aanbod/reviews/verkopen horen bij
  // het handelsmodel; zonder flags blijft het een spelersprofiel (Over + Team).
  const features = getFeatureSnapshot(session?.user?.accountType);
  const activeOffers = profile.activeOffers.filter((o) =>
    o.type === "auction"
      ? features.FEATURE_AUCTIONS
      : o.type === "claimsale"
        ? features.FEATURE_CLAIMSALES
        : features.FEATURE_MARKETPLACE,
  );
  const anyTrade = features.FEATURE_AUCTIONS || features.FEATURE_CLAIMSALES || features.FEATURE_MARKETPLACE;

  const tabs = [
    ...(anyTrade
      ? [
          {
            key: "offers",
            label: t("tabOffers"),
            count: activeOffers.length,
            content: <ProfileOfferGrid offers={activeOffers} isOwner={isOwner} />,
          },
        ]
      : []),
    ...(features.FEATURE_WALLET
      ? [
          {
            key: "reviews",
            label: t("tabReviews"),
            count: profile.reviews.length,
            content: <ReviewsTable reviews={profile.reviews} />,
          },
        ]
      : []),
    { key: "about", label: t("tabAbout"), content: <SellerAboutPanel profile={profile} locale={locale} features={features} /> },
    ...(profile.recentSales && features.FEATURE_WALLET
      ? [{ key: "sales", label: t("tabSales"), count: profile.recentSales.length, content: <RecentSalesTable sales={profile.recentSales} /> }]
      : []),
  ];

  return (
    <PageContainer width="default" className="py-6 sm:py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span>{t("breadcrumbSellers")}</span>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <div className="space-y-8">
        <SellerProfileHeader
          profile={profile}
          isOwner={isOwner}
          viewerLoggedIn={isLoggedIn}
          initiallyBlocked={initiallyBlocked}
          variant="profile"
          locale={locale}
          features={features}
        />

        <SellerHistoryTabs tabs={tabs} />

        <SellerTeamBlock profile={profile} isOwner={isOwner} />
      </div>
    </PageContainer>
  );
}
