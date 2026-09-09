import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Star } from "lucide-react";
import { formatDateShort, formatCurrency } from "@/lib/format";
import { getFullName } from "@/lib/user-name";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import type { SellerReviewRow, SellerOfferRow, SellerSaleRow } from "@/lib/seller-profile-data";

/**
 * Tabellen voor het "Geschiedenis"-blok van het verkopersprofiel (Fase 45),
 * in de stijl van de referentie: muted uppercase-kop, status-pills, rechts
 * een "Bekijk"-link, horizontaal scrollbaar op smalle schermen.
 */

function HistoryTable({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: string | null }) {
  if (empty) {
    return (
      <div className="dash-card px-6 py-10 text-center text-sm text-muted-foreground">{empty}</div>
    );
  }
  return (
    <div className="dash-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {head.map((h, i) => (
                <th key={h + i} className={`px-4 py-3 font-medium ${i === head.length - 1 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

const TYPE_TONE: Record<string, StatusTone> = {
  auction: "info",
  listing: "success",
  claimsale: "warning",
  bundle: "primary",
};

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  LIVE: "success",
  SCHEDULED: "info",
  PARTIALLY_SOLD: "warning",
  PAID: "info",
  SHIPPED: "warning",
  COMPLETED: "success",
};

function ratingTone(rating: number): StatusTone {
  if (rating >= 4) return "success";
  if (rating === 3) return "warning";
  return "danger";
}

export async function ReviewsTable({ reviews }: { reviews: SellerReviewRow[] }) {
  const t = await getTranslations("sellerProfile");
  return (
    <HistoryTable
      head={[t("colDate"), t("colReviewer"), t("colRating"), t("colItem"), t("colReview")]}
      empty={reviews.length === 0 ? t("noReviews") : null}
    >
      {reviews.map((r) => (
        <tr key={r.id} className="align-top transition-colors hover:bg-muted/40">
          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateShort(r.createdAt)}</td>
          <td className="whitespace-nowrap px-4 py-3">
            <span className="block font-medium text-foreground">{getFullName(r.reviewer)}</span>
            <span className="block text-xs text-muted-foreground">@{r.reviewer.displayName}</span>
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <StatusBadge tone={ratingTone(r.rating)} icon={Star}>
              {r.rating}/5
            </StatusBadge>
          </td>
          <td className="px-4 py-3 text-foreground">
            {r.itemHref && r.itemTitle ? (
              <Link href={r.itemHref} className="hover:text-primary hover:underline">
                {r.itemTitle}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </td>
          <td className="px-4 py-3 text-right">
            <p className="text-left text-foreground">{r.comment ?? <span className="text-muted-foreground">—</span>}</p>
            {r.sellerResponse && (
              <p className="mt-1 text-left text-xs text-muted-foreground">
                <span className="font-medium text-primary">{t("sellerResponse")}:</span> {r.sellerResponse}
              </p>
            )}
          </td>
        </tr>
      ))}
    </HistoryTable>
  );
}

export async function ActiveOffersTable({ offers }: { offers: SellerOfferRow[] }) {
  const t = await getTranslations("sellerProfile");
  const typeLabel: Record<SellerOfferRow["type"], string> = {
    auction: t("typeAuction"),
    listing: t("typeListing"),
    claimsale: t("typeClaimsale"),
  };
  return (
    <HistoryTable
      head={[t("colDate"), t("colTitle"), t("colType"), t("colPrice"), t("colStatus"), ""]}
      empty={offers.length === 0 ? t("noOffers") : null}
    >
      {offers.map((o) => (
        <tr key={`${o.type}-${o.id}`} className="transition-colors hover:bg-muted/40">
          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateShort(o.createdAt)}</td>
          <td className="px-4 py-3 font-medium text-foreground">{o.title}</td>
          <td className="whitespace-nowrap px-4 py-3">
            <StatusBadge tone={TYPE_TONE[o.type]}>{typeLabel[o.type]}</StatusBadge>
          </td>
          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">
            {o.price != null ? (o.type === "claimsale" ? t("fromPrice", { price: formatCurrency(o.price) }) : formatCurrency(o.price)) : "—"}
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <StatusBadge tone={STATUS_TONE[o.status] ?? "neutral"}>{t(`status_${o.status}`)}</StatusBadge>
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-right">
            <Link href={o.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t("view")}
              <ArrowRight className="size-3.5" />
            </Link>
          </td>
        </tr>
      ))}
    </HistoryTable>
  );
}

export async function RecentSalesTable({ sales }: { sales: SellerSaleRow[] }) {
  const t = await getTranslations("sellerProfile");
  const typeLabel: Record<SellerSaleRow["type"], string> = {
    auction: t("typeAuction"),
    listing: t("typeListing"),
    claimsale: t("typeClaimsale"),
    bundle: t("typeBundle"),
  };
  return (
    <HistoryTable
      head={[t("colDate"), t("colOrder"), t("colType"), t("colItems"), t("colTotal"), t("colStatus")]}
      empty={sales.length === 0 ? t("noSales") : null}
    >
      {sales.map((s) => (
        <tr key={s.id} className="transition-colors hover:bg-muted/40">
          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateShort(s.createdAt)}</td>
          <td className="px-4 py-3">
            <Link href="/dashboard/verkopen" className="font-medium text-primary hover:underline">
              {s.orderNumber}
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground">{s.title}</p>
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <StatusBadge tone={TYPE_TONE[s.type]}>{typeLabel[s.type]}</StatusBadge>
          </td>
          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">{s.itemCount}</td>
          <td className="whitespace-nowrap px-4 py-3 tabular-nums font-semibold text-foreground">{formatCurrency(s.total)}</td>
          <td className="whitespace-nowrap px-4 py-3 text-right">
            <StatusBadge tone={STATUS_TONE[s.status] ?? "neutral"}>{t(`status_${s.status}`)}</StatusBadge>
          </td>
        </tr>
      ))}
    </HistoryTable>
  );
}
