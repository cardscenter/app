import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { fetchActiveActivity } from "@/lib/dashboard-queries";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { PageTabs } from "@/components/dashboard/page-tabs";

/**
 * Cluster-koppen (Fase 44): samengevoegde dashboard-onderdelen delen één
 * paginakop + tab-balk. Dunne server-wrappers rond DashboardPageHeader +
 * PageTabs die vertaalde labels en live counts aanleveren.
 */

export async function OfferTabs({ userId, action }: { userId: string; action?: ReactNode }) {
  const t = await getTranslations("dashboard");
  // fetchActiveActivity is React-cache()d — de dashboard-layout haalt dezelfde
  // counts al op voor de nav-badge, dus dit kost geen extra queries.
  const activity = await fetchActiveActivity(userId);

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={t("clusterOfferTitle")}
        subtitle={t("clusterOfferSubtitle")}
        action={action}
      />
      <PageTabs
        tabs={[
          { href: "/dashboard/veilingen", label: t("myAuctions"), badge: activity.counts.auctions },
          { href: "/dashboard/claimsales", label: t("myClaimsales"), badge: activity.counts.claimsales },
          { href: "/dashboard/marktplaats", label: t("myListings"), badge: activity.counts.listings },
          {
            href: "/dashboard/evenementen",
            label: t("myEvents"),
            badge: activity.counts.events,
            // Zonder eigen events geen tab — maar een deep-link naar de pagina
            // toont 'm wel zodat de bezoeker niet visueel zoekraakt.
            hideUnlessActive: activity.counts.events === 0,
          },
        ]}
      />
    </div>
  );
}

export async function FinanceTabs({ action }: { action?: ReactNode }) {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={t("clusterFinanceTitle")}
        subtitle={t("clusterFinanceSubtitle")}
        action={action}
      />
      <PageTabs
        tabs={[
          { href: "/dashboard/saldo", label: t("tabBalance"), exact: true },
          { href: "/dashboard/uitbetalingen", label: t("tabWithdrawals") },
          { href: "/dashboard/saldo/openstaande-kosten", label: t("tabPendingFees") },
        ]}
      />
    </div>
  );
}

export async function ReputationTabs({ action }: { action?: ReactNode }) {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title={t("clusterReputationTitle")}
        subtitle={t("clusterReputationSubtitle")}
        action={action}
      />
      <PageTabs
        tabs={[
          { href: "/dashboard/reviews", label: t("tabReviews") },
          { href: "/dashboard/level", label: t("tabLevel") },
        ]}
      />
    </div>
  );
}
