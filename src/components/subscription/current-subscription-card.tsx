import { getTranslations } from "next-intl/server";
import { Crown } from "lucide-react";

interface Subscription {
  id: string;
  tier: string;
  billingCycle: string;
  status: string;
  paymentStatus: string;
  startsAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
  gracePeriodEnd: Date | null;
}

interface Props {
  accountType: string;
  isAdmin: boolean;
  tierName: string;
  currentCommissionPct: string;
  subscription: Subscription | null;
}

export async function CurrentSubscriptionCard({
  accountType,
  isAdmin,
  tierName,
  currentCommissionPct,
  subscription,
}: Props) {
  const t = await getTranslations("subscription");

  let statusLine: string | null = null;
  let statusColor = "text-muted-foreground";

  if (subscription) {
    if (subscription.status === "PENDING") {
      statusLine = t("subscriptionStatusPending");
      statusColor = "text-amber-600 dark:text-amber-400";
    } else if (subscription.paymentStatus === "GRACE" && subscription.gracePeriodEnd) {
      const daysLeft = Math.max(
        0,
        Math.ceil((subscription.gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );
      statusLine = t("subscriptionStatusGrace", { days: String(daysLeft) });
      statusColor = "text-rose-600 dark:text-rose-400";
    } else if (subscription.status === "CANCELLED") {
      statusLine = t("cancelledNotice");
      statusColor = "text-amber-600 dark:text-amber-400";
    } else if (subscription.status === "ACTIVE") {
      statusLine = t("subscriptionStatusActive");
      statusColor = "text-emerald-600 dark:text-emerald-400";
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("currentTier")}</p>
            <p className="text-xl font-bold text-foreground">{tierName}</p>
          </div>
        </div>

        {statusLine && (
          <span className={`rounded-full bg-muted px-3 py-1 text-xs font-medium ${statusColor}`}>
            {statusLine}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>
          {t("commissionRate")}: <span className="font-medium text-foreground">{currentCommissionPct}%</span>
        </span>
        {subscription && (
          <>
            <span>
              {t("billingCycle")}:{" "}
              <span className="font-medium text-foreground">
                {t(subscription.billingCycle === "YEARLY" ? "yearly" : "monthly")}
              </span>
            </span>
            <span>
              {t("expiresAt")}:{" "}
              <span className="font-medium text-foreground">
                {new Date(subscription.expiresAt).toLocaleDateString("nl-NL")}
              </span>
            </span>
          </>
        )}
        {isAdmin && (
          <span className="text-violet-600 dark:text-violet-400">
            ADMIN: alle features ontgrendeld
          </span>
        )}
      </div>
    </div>
  );
}
