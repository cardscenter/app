import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import type {
  ActionItemsCounts,
  BalanceOverview,
  ActiveActivity,
  RecentBundles,
} from "@/lib/dashboard-queries";
import { ActionItemsWidget } from "./action-items-widget";
import { BalanceOverviewWidget } from "./balance-overview-widget";
import { ActiveActivityWidget } from "./active-activity-widget";
import { RecentBundlesWidget } from "./recent-bundles-widget";

type Props = {
  actionItems: ActionItemsCounts;
  balance: BalanceOverview;
  activity: ActiveActivity;
  bundles: RecentBundles;
  showPremiumCta: boolean;
  /** Fase 16-followup: false → optionele "stel 2FA in"-suggestie in de widget. */
  totpEnabled?: boolean;
  /** Fase 43: false → "vul je verzendadres aan"-tegel in de widget. */
  hasShippingAddress?: boolean;
};

export async function DashboardEssentials({
  actionItems,
  balance,
  activity,
  bundles,
  showPremiumCta,
  totpEnabled = true,
  hasShippingAddress = true,
}: Props) {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <ActionItemsWidget
        counts={actionItems}
        totpEnabled={totpEnabled}
        hasShippingAddress={hasShippingAddress}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BalanceOverviewWidget data={balance} />
        <ActiveActivityWidget data={activity} />
      </div>

      <RecentBundlesWidget data={bundles} />

      {showPremiumCta && (
        <Link
          href="/dashboard/statistieken"
          className="glass-subtle group flex items-center justify-between rounded-xl p-5 transition-colors hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("statistics.viewDetailedStats")}
              </p>
              <p className="text-xs text-muted-foreground">{t("statistics.subtitle")}</p>
            </div>
          </div>
          <span className="text-primary transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
