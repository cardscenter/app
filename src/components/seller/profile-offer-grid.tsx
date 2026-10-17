import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Heart, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { FallbackImage } from "@/components/ui/fallback-image";
import type { SellerOfferRow } from "@/lib/seller-profile-data";

const TYPE_STYLE: Record<SellerOfferRow["type"], { pill: string; tint: string }> = {
  auction: { pill: "bg-blue-600 text-white", tint: "from-blue-100/80 to-sky-50" },
  listing: { pill: "bg-emerald-600 text-white", tint: "from-emerald-100/80 to-teal-50" },
  claimsale: { pill: "bg-amber-500 text-white", tint: "from-amber-100/80 to-orange-50" },
};

/**
 * "Aanbod"-raster op het verkopersprofiel (redesign sept 2026, Portfolia-
 * stijl): grote zachte tegel met de foto, type-zegel rechtsboven, daaronder
 * titel + subregel (type · conditie) en rechts de hartjes-teller en prijs.
 */
export async function ProfileOfferGrid({ offers, isOwner }: { offers: SellerOfferRow[]; isOwner: boolean }) {
  const t = await getTranslations("sellerProfile");

  if (offers.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={t("noOffers")}
        description={isOwner ? t("noOffersOwner") : undefined}
        compact
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((o) => {
        const style = TYPE_STYLE[o.type];
        const typeLabel =
          o.type === "auction" ? t("typeAuction") : o.type === "listing" ? t("typeListing") : t("typeClaimsale");
        const subline = [
          o.itemType ? t(`itemType_${o.itemType}` as never) : null,
          o.itemCount !== null ? t("itemCount", { count: o.itemCount }) : null,
          o.condition,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Link key={`${o.type}-${o.id}`} href={o.href} className="group block">
            <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br ${style.tint}`}>
              <FallbackImage src={o.imageUrl} className="transition-transform duration-300 group-hover:scale-[1.03]" />
              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${style.pill}`}
              >
                {typeLabel}
              </span>
              {o.status === "SCHEDULED" && (
                <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                  {t("status_SCHEDULED")}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-primary">{o.title}</h3>
                {subline && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subline}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  <Heart className="size-3" />
                  {o.likes}
                </span>
                {o.price !== null && (
                  <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                    {o.type === "claimsale" ? t("fromPrice", { price: formatCurrency(o.price) }) : formatCurrency(o.price)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
