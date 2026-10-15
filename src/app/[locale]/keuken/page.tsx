import { setRequestLocale } from "next-intl/server";
import { getMenu } from "@/lib/food/menu-server";
import { KitchenBoard } from "@/components/food/kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const menu = await getMenu({ includeDisabled: true });
  return <KitchenBoard locale={locale} menu={{ categories: menu.categories, items: menu.items, byId: menu.byId }} />;
}
