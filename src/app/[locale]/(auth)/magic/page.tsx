import { setRequestLocale } from "next-intl/server";
import { AuthMarketingAside } from "@/components/auth/auth-marketing-aside";
import { MagicLogin } from "./magic-login";

/**
 * Landingspagina van de inloglink (Community Hub, Fase 2). De client-
 * component wisselt het token in via signIn("magic-link"); het token staat
 * alleen in de URL van de mail en wordt eenmalig gebruikt.
 */
export default async function MagicPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  return (
    <>
      <MagicLogin locale={locale} token={token ?? null} />
      <AuthMarketingAside variant="login" />
    </>
  );
}
