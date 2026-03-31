import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ACCOUNT_TIERS, getTierConfig, type TierKey } from "@/lib/subscription-tiers";
import { Check, X, Crown, Zap, Sparkles } from "lucide-react";

export default async function SubscriptionPage() {
  const session = await auth();
  const t = await getTranslations("subscription");

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    select: { accountType: true, premiumExpiresAt: true },
  });

  if (!user) return null;

  const currentTier = getTierConfig(user.accountType);
  const isAdmin = user.accountType === "ADMIN";

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session!.user!.id, status: { in: ["ACTIVE", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
  });

  const tiers = [
    { key: "FREE" as TierKey, icon: Sparkles, color: "zinc" },
    { key: "PRO" as TierKey, icon: Zap, color: "blue" },
    { key: "UNLIMITED" as TierKey, icon: Crown, color: "amber" },
  ];

  const featureRows = [
    { labelKey: "activeAuctions", getValue: (tier: TierKey) => ACCOUNT_TIERS[tier].limits.maxActiveAuctions === Infinity ? t("unlimited") : String(ACCOUNT_TIERS[tier].limits.maxActiveAuctions) },
    { labelKey: "activeClaimsales", getValue: (tier: TierKey) => ACCOUNT_TIERS[tier].limits.maxActiveClaimsales === Infinity ? t("unlimited") : String(ACCOUNT_TIERS[tier].limits.maxActiveClaimsales) },
    { labelKey: "activeListings", getValue: (tier: TierKey) => ACCOUNT_TIERS[tier].limits.maxActiveListings === Infinity ? t("unlimited") : String(ACCOUNT_TIERS[tier].limits.maxActiveListings) },
    { labelKey: "cardsPerClaimsale", getValue: (tier: TierKey) => String(ACCOUNT_TIERS[tier].limits.maxItemsPerClaimsale) },
    { labelKey: "commission", getValue: (tier: TierKey) => `${(ACCOUNT_TIERS[tier].commissionRate * 100).toFixed(1)}%` },
    { labelKey: "upsellDiscount", getValue: (tier: TierKey) => ACCOUNT_TIERS[tier].upsellDiscount > 0 ? `${(ACCOUNT_TIERS[tier].upsellDiscount * 100).toFixed(0)}%` : "-" },
    { labelKey: "statistics", getValue: (tier: TierKey) => ACCOUNT_TIERS[tier].features.statistics },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

      {/* Current tier info */}
      <div className="mt-6 rounded-2xl border border-border p-6 glass-subtle">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("currentTier")}</p>
            <p className="text-xl font-bold text-foreground">
              {isAdmin ? "Admin (Unlimited)" : t(currentTier.nameKey)}
            </p>
          </div>
        </div>

        {subscription && (
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            <p>{t("billingCycle")}: {t(subscription.billingCycle === "YEARLY" ? "yearly" : "monthly")}</p>
            <p>{t("expiresAt")}: {new Date(subscription.expiresAt).toLocaleDateString("nl-NL")}</p>
            {subscription.status === "CANCELLED" && (
              <p className="text-amber-600 dark:text-amber-400">{t("cancelledNotice")}</p>
            )}
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          <p>{t("commissionRate")}: {(currentTier.commissionRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Tier comparison table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("comparePlans")}</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tiers.map(({ key, icon: Icon, color }) => {
            const tier = ACCOUNT_TIERS[key];
            const isCurrent = user.accountType === key || (isAdmin && key === "UNLIMITED");

            return (
              <div
                key={key}
                className={`rounded-2xl border-2 p-6 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border glass-subtle"
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`h-5 w-5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                  <h3 className="text-lg font-bold text-foreground">{t(tier.nameKey)}</h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {tier.monthlyPrice === 0 ? (
                    <p className="text-3xl font-bold text-foreground">{t("free")}</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-foreground">
                        &euro;{tier.monthlyPrice.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">/{t("month")}</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("orYearly", { price: tier.yearlyPrice.toFixed(2) })}
                      </p>
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {featureRows.map((row) => {
                    const value = row.getValue(key);
                    const isBoolean = typeof value === "boolean";
                    return (
                      <li key={row.labelKey} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t(row.labelKey)}</span>
                        {isBoolean ? (
                          value ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-zinc-400" />
                          )
                        ) : (
                          <span className="font-medium text-foreground">{value}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* CTA */}
                <div className="mt-6">
                  {isCurrent ? (
                    <div className="w-full rounded-xl bg-primary/10 py-2.5 text-center text-sm font-medium text-primary">
                      {t("currentPlan")}
                    </div>
                  ) : key === "FREE" ? null : (
                    <div className="w-full rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-white opacity-50 cursor-not-allowed">
                      {t("upgradeSoon")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
