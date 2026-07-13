import { redirect } from "next/navigation";

/**
 * TIJDELIJKE LOCKDOWN (Fase 44): personalisatie is voorlopig niet
 * toegankelijk voor gebruikers — verwijder dit bestand om de hub
 * (hub/achievements/packs/inventory/equip) weer te openen.
 *
 * Achievements blijven op de achtergrond XP/Ember opbouwen en zijn zichtbaar
 * via de teaser op /dashboard/level; de unlock-toast blijft actief (uit te
 * zetten via /dashboard/instellingen).
 *
 * Redirect via next/navigation met handmatige locale-prefix — de i18n-redirect
 * gaf in Next 16 + next-intl 4 "This page couldn't load" (zie CLAUDE.md).
 */
export default async function CustomizationLockdownLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
