import { getTranslations } from "next-intl/server";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/seller-levels";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import type { SellerProfileData } from "@/lib/seller-profile-data";

/**
 * Rij van vier stat-kaartjes onder de profiel-header (Fase 45): waarde groot,
 * eenheid klein, gekleurd sub-label ("Uitstekend", "Startend", …).
 */
export async function SellerStatRow({ profile }: { profile: SellerProfileData }) {
  const t = await getTranslations("sellerProfile");
  const { stats, activeCounts } = profile;
  const level = getLevel(stats.xp);
  const next = getNextLevel(stats.xp);
  const progress = getLevelProgress(stats.xp);

  const ratingTone: { label: string; tone: StatusTone } =
    stats.totalReviews === 0
      ? { label: t("toneNew"), tone: "neutral" }
      : stats.avgRating >= 4.5
        ? { label: t("toneExcellent"), tone: "success" }
        : stats.avgRating >= 4
          ? { label: t("toneGood"), tone: "success" }
          : stats.avgRating >= 3
            ? { label: t("toneAverage"), tone: "warning" }
            : { label: t("toneBelow"), tone: "danger" };

  const salesTone: { label: string; tone: StatusTone } =
    stats.totalSales === 0
      ? { label: t("toneNone"), tone: "neutral" }
      : stats.totalSales < 10
        ? { label: t("toneStarting"), tone: "info" }
        : stats.totalSales < 50
          ? { label: t("toneActive"), tone: "success" }
          : { label: t("toneAboveAverage"), tone: "success" };

  const activeTotal = activeCounts.auctions + activeCounts.listings + activeCounts.claimsales;

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label={t("rating")}
        value={stats.totalReviews > 0 ? stats.avgRating.toFixed(1) : "—"}
        unit={stats.totalReviews > 0 ? "★" : undefined}
        sub={<StatusBadge tone={ratingTone.tone}>{ratingTone.label}</StatusBadge>}
        hint={t("reviewsCount", { count: stats.totalReviews })}
      />
      <StatTile
        label={t("completedSales")}
        value={String(stats.totalSales)}
        sub={<StatusBadge tone={salesTone.tone}>{salesTone.label}</StatusBadge>}
        hint={t("positivePercent", { percent: stats.positivePercent })}
      />
      <StatTile
        label={t("activeOffers")}
        value={String(activeTotal)}
        sub={
          <span className="text-xs text-muted-foreground">
            {t("offerSplit", {
              auctions: activeCounts.auctions,
              listings: activeCounts.listings,
              claimsales: activeCounts.claimsales,
            })}
          </span>
        }
      />
      <StatTile
        label={t("level")}
        value={`${level.icon} ${level.name}`}
        sub={
          <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {next ? t("xpToNext", { xp: next.minXP - stats.xp, level: next.name }) : t("maxLevel")}
            </p>
          </div>
        }
      />
    </section>
  );
}

function StatTile({
  label,
  value,
  unit,
  sub,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="dash-card flex flex-col gap-2 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="truncate text-2xl font-bold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {sub}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
