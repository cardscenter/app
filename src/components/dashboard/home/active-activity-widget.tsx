"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Gavel, Tag, Store, TrendingUp, TrendingDown } from "lucide-react";
import type { ActiveActivity } from "@/lib/dashboard-queries";

type Props = { data: ActiveActivity };

export function ActiveActivityWidget({ data }: Props) {
  const t = useTranslations("dashboard.essentials.activity");

  const sellerRows = [
    {
      key: "activeAuctions",
      count: data.counts.auctions,
      href: "/dashboard/veilingen",
      icon: Gavel,
    },
    {
      key: "activeListings",
      count: data.counts.listings,
      href: "/dashboard/marktplaats",
      icon: Store,
    },
    {
      key: "activeClaimsales",
      count: data.counts.claimsales,
      href: "/dashboard/claimsales",
      icon: Tag,
    },
  ] as const;

  return (
    <div className="glass-subtle rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{t("title")}</h3>

      <div className="space-y-2">
        {sellerRows.map(({ key, count, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              {t(key)}
            </div>
            <span className="text-sm font-semibold text-foreground">{count}</span>
          </Link>
        ))}
      </div>

      {data.bids.totalActive > 0 && (
        <>
          <div className="my-3 border-t border-border/50" />
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">{t("myBids")}</p>
            <Link href="/dashboard/biedingen" className="text-xs text-primary hover:underline">
              {data.bids.totalActive}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("bidHighest")}</p>
                <p className="text-sm font-bold text-foreground">{data.bids.highest}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-red-500/5 p-2">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("bidOutbid")}</p>
                <p className="text-sm font-bold text-foreground">{data.bids.outbid}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
