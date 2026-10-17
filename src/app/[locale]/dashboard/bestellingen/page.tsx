import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/food/orders";
import { getMenu } from "@/lib/food/menu-server";
import { DashboardPageHeader } from "@/components/dashboard/ui/page-header";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { formatEuro } from "@/lib/food/pricing";
import { formatEventDateShort, formatEventTime } from "@/lib/shop-events/format";
import { PILL_BTN_SM } from "@/components/ploy/tile-styles";

export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warning" | "neutral" | "info" | "danger"> = { NEW: "info", PREPARING: "info", READY: "success", DONE: "neutral", AWAITING_PAYMENT: "warning", PAYMENT_FAILED: "danger" };

/** Bestelgeschiedenis van een ingelogde gast (eten en drinken). */
export default async function MyFoodOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login?callbackUrl=/dashboard/bestellingen`);
  const t = await getTranslations("food");
  const [orders, menu] = await Promise.all([listOrdersForUser(session.user.id, 25), getMenu({ includeDisabled: true })]);
  const lang = locale === "en" ? "en" : "nl";
  const nm = (id: string) => { const it = menu.byId[id]; return it ? (lang === "nl" ? it.name : it.nameEn) : id; };
  const statusLabel = (s: string) => ({ NEW: t("st1"), PREPARING: t("st2"), READY: t("st3B"), DONE: t("stDoneB"), AWAITING_PAYMENT: t("stPay"), PAYMENT_FAILED: t("payFailedTitle") })[s] ?? s;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title={t("myOrders")} subtitle={t("myOrdersSubtitle")} />
      {orders.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} tone="green" title={t("noOrders")} description={t("scanHint")} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="dash-card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <span className="cc-display text-3xl tabular-nums text-foreground">#{o.number}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground">{o.lines.filter((l) => !l.g || l.role === "main").map((l) => `${l.qty > 1 ? l.qty + "× " : ""}${nm(l.id)}`).join(", ")}</div>
                <div className="text-xs text-muted-foreground">{formatEventDateShort(new Date(o.createdAt), lang)} {formatEventTime(new Date(o.createdAt), lang)} · {o.mode === "TABLE" ? t("tableN", { n: o.table ?? 0 }) : o.name}</div>
              </div>
              <span className="text-right text-base font-semibold tabular-nums text-foreground">
                {formatEuro(o.total + o.tip, lang)}
                {o.pointsUsed > 0 && <span className="block text-xs font-normal text-muted-foreground">{t("pointsUseSub", { n: o.pointsUsed, amt: formatEuro(o.pointsDiscount, lang) })}</span>}
              </span>
              <StatusBadge tone={TONE[o.status] ?? "neutral"}>{statusLabel(o.status)}</StatusBadge>
              {o.status !== "DONE" && o.status !== "PAYMENT_FAILED" && (
                <Link href={`/bestellen/status/${o.id}`} className={PILL_BTN_SM}>{t("statusLink")}</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
