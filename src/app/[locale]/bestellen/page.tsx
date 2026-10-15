import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getMenu, getWaitMinutes } from "@/lib/food/menu-server";
import { TABLE_MAX, TABLE_MIN } from "@/lib/food/menu-data";
import { BestelApp } from "@/components/food/bestel-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bestellen | Cards Center",
  description: "Bestel eten en drinken met je eigen telefoon in de winkel van Cards Center in Hulst.",
  robots: { index: false },
};

/**
 * Bestelapp (Community Hub, Fase 4). Entree via de QR-code:
 *   /bestellen?tafel=7   → tafelmodus (1 t/m 16)
 *   /bestellen?modus=bar → barmodus (naam invullen, afhalen aan de bar)
 * Zonder parameters: uitleg om de QR te scannen (de app werkt wel, met de
 * laatst gebruikte tafel uit de sessie).
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tafel?: string; modus?: string; table?: string; mode?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [menu, waitMinutes] = await Promise.all([getMenu(), getWaitMinutes()]);

  const tableRaw = sp.tafel ?? sp.table;
  const table = tableRaw ? Number(tableRaw) : null;
  const validTable = table !== null && Number.isInteger(table) && table >= TABLE_MIN && table <= TABLE_MAX;
  const entry: { mode: "TABLE" | "BAR"; table: number } | { invalidTable: true } | null =
    sp.modus === "bar" || sp.mode === "bar" ? { mode: "BAR", table: 0 } : validTable ? { mode: "TABLE", table: table! } : tableRaw ? { invalidTable: true } : null;

  return (
    <BestelApp
      locale={locale}
      menu={{ categories: menu.categories, items: menu.items, byId: menu.byId }}
      waitMinutes={waitMinutes}
      entry={entry}
    />
  );
}
