import { setRequestLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { applyGuardianConsent } from "@/lib/guardian-consent-server";
import { AuthFrame } from "@/components/ploy/auth-frame";

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
    <AuthFrame>
      <div className="w-full text-center">
        {result.ok ? (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--pastel-green)]"><CheckCircle2 className="size-7 text-[var(--foreground)]" /></span>
            <h1 className="cc-display mt-5 text-[36px] text-[var(--foreground)] sm:text-[44px]">
              {result.alreadyGiven ? t("alreadyTitle") : t("successTitle")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("successBody", { name: result.childDisplayName })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("revokeHint")}</p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--pastel-pink)]"><XCircle className="size-7 text-[var(--foreground)]" /></span>
            <h1 className="cc-display mt-5 text-[36px] text-[var(--foreground)] sm:text-[44px]">{t("invalidTitle")}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {result.reason === "expired" ? t("expiredBody") : t("invalidBody")}
            </p>
          </>
        )}
        <Link href="/" className="mt-8 cc-pill inline-flex w-full items-center justify-center gap-1.5 border border-[var(--border)] bg-white px-6 py-4 text-sm font-semibold leading-none text-[var(--foreground)] transition-colors hover:bg-[var(--background)]">
          {t("toHome")}
        </Link>
      </div>
    </AuthFrame>
  );
}
