import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/home/landing/landing-page";

/**
 * Homepage: altijd de landing in de nieuwe stijl (design-pass 2026-10, zie
 * docs/design/DESIGN.md). De oude marketing-homepage met handel-secties en de
 * vorige hub-homepage zijn op 2026-10-17 losgekoppeld; komt de handel terug,
 * dan krijgt die eigen panelen op deze landing, in de nieuwe stijl. Oude
 * versies staan in git-tag `backup/homepage-pre-design-2026-10-16`.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  const viewer = session?.user?.id
    ? { id: session.user.id, name: session.user.name ?? "", image: session.user.image ?? null }
    : null;
  return <LandingPage locale={locale} viewer={viewer} />;
}
