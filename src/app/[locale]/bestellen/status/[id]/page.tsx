import { setRequestLocale } from "next-intl/server";
import { getMenu } from "@/lib/food/menu-server";
import { getGuestOrder } from "@/lib/food/orders";
import { auth } from "@/lib/auth";
import { OrderStatusView } from "@/components/food/order-status-view";

export const dynamic = "force-dynamic";

/**
 * Statuspagina van een bestelling (bevestiging + live status). Gast-toegang
 * via `?t=<accessToken>`; de client pollt elke 5 seconden.
 */
export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { t } = await searchParams;
  const session = await auth();
  const [menu, order] = await Promise.all([getMenu({ includeDisabled: true }), getGuestOrder(id, t ?? "", session?.user?.id ?? null)]);
  return <OrderStatusView locale={locale} orderId={id} token={t ?? ""} initial={order} menu={{ categories: menu.categories, items: menu.items, byId: menu.byId }} />;
}
