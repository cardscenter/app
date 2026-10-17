"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Gavel, Tag, Store, TrendingUp, TrendingDown, Activity } from "lucide-react";
import type { ActiveActivity } from "@/lib/dashboard-queries";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { TONE_ICON } from "@/components/dashboard/ui/tones";

type Props = { data: ActiveActivity };

export function ActiveActivityWidget({ data }: Props) {
  const t = useTranslations("dashboard.essentials.activity");
  // Feature-flags (Community Hub, Fase 1): rijen van verborgen handelssoorten weg.
  const features = useFeatureFlags();

  const sellerRows = [
    {
      key: "activeAuctions",
      count: data.counts.auctions,
      href: "/dashboard/veilingen",
      icon: Gavel,
      show: features.FEATURE_AUCTIONS,
    },
    {
      key: "activeListings",
      count: data.counts.listings,
      href: "/dashboard/marktplaats",
      icon: Store,
      show: features.FEATURE_MARKETPLACE,
    },
    {
      key: "activeClaimsales",
      count: data.counts.claimsales,
      href: "/dashboard/claimsales",
      icon: Tag,
      show: features.FEATURE_CLAIMSALES,
    },
  ].filter((r) => r.show);

  return (
    <section className="overflow-hidden dash-card">
      <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
        <Activity className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{t("title")}</h2>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="space-y-1">
          {sellerRows.map(({ key, count, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className="flex items-center justify-between rounded-full px-3 py-2 transition-colors hover:bg-[var(--background)]"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4" />
                {t(key)}
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>
            </Link>
          ))}
        </div>

        {features.FEATURE_AUCTIONS && data.bids.totalActive > 0 && (
          <>
            <div className="my-3 border-t border-border" />
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("myBids")}</p>
              <Link href="/dashboard/biedingen" className="text-xs font-semibold text-primary hover:underline">
                {data.bids.totalActive}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-[14px] bg-[var(--background)] p-2.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE_ICON.green}`}>
                  <TrendingUp className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("bidHighest")}</p>
                  <p className="cc-display text-xl tabular-nums text-foreground">{data.bids.highest}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-[14px] bg-[var(--background)] p-2.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE_ICON.pink}`}>
                  <TrendingDown className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("bidOutbid")}</p>
                  <p className="cc-display text-xl tabular-nums text-foreground">{data.bids.outbid}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
