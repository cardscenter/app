import { setRequestLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Link } from "@/i18n/navigation";
import { applyGuardianConsent } from "@/lib/guardian-consent-server";
import { buttonVariants } from "@/components/ui/button-variants";

export const dynamic = "force-dynamic";

/**
 * Publieke landingspagina van de ouder-toestemmingslink (Community Hub,
 * Fase 2). Geen login: de ouder heeft meestal geen account. Het token wordt
 * bij het openen verzilverd; een tweede klik toont "staat al".
 */
export default async function GuardianConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("guardian");

  const result = await applyGuardianConsent(token);

  return (
    <PageContainer width="narrow" className="py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {result.ok ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">
              {result.alreadyGiven ? t("alreadyTitle") : t("successTitle")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("successBody", { name: result.childDisplayName })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("revokeHint")}</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto size-12 text-rose-500" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{t("invalidTitle")}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {result.reason === "expired" ? t("expiredBody") : t("invalidBody")}
            </p>
          </>
        )}
        <Link href="/" className={`${buttonVariants({ variant: "outline" })} mt-6`}>
          {t("toHome")}
        </Link>
      </div>
    </PageContainer>
  );
}
