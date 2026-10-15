"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ThemeToggle } from "@/components/toggle-theme";
import { LanguageSwitcher } from "./language-switcher";
import { PageContainer } from "@/components/layout/page-container";
import { ZDivider } from "@/components/ui/z-divider";
import { PLATFORM, formatPlatformAddress, hasKvk, hasVat } from "@/lib/platform-config";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";

const FOOTER_LINK_CLASS = "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function Footer() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");
  const currentYear = new Date().getFullYear();
  const features = useFeatureFlags();

  return (
    <>
      {/* Z-divider boven de footer. Marge erboven (mt-16) geeft een lege
          bg-background-strook zodat de content erboven niet achter de blade
          valt; de blade prikt in die strook en sluit naadloos aan op de footer. */}
      <ZDivider fillClassName="text-muted" height={44} className="mt-16" />
      <footer className="bg-muted">
        <PageContainer width="wide" className="py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-block">
              {/* Dark mode: white text logo */}
              <Image
                src="/images/logo-dark-mode.png"
                alt="Cards Center"
                width={200}
                height={56}
                className="hidden h-14 w-auto dark:block"
              />
              {/* Light mode: dark text logo */}
              <Image
                src="/images/logo-white-bg.png"
                alt="Cards Center"
                width={200}
                height={56}
                className="h-14 w-auto dark:hidden"
              />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("navigation")}
            </h3>
            {/* Zelfde volgorde als de header: primaire secties, dan de secundaire. */}
            <div className="mt-3 flex flex-col gap-2">
              {features.FEATURE_AUCTIONS && <Link href="/veilingen" className={FOOTER_LINK_CLASS}>{tc("auctions")}</Link>}
              {features.FEATURE_CLAIMSALES && <Link href="/claimsales" className={FOOTER_LINK_CLASS}>{tc("claimsales")}</Link>}
              {features.FEATURE_MARKETPLACE && <Link href="/marktplaats" className={FOOTER_LINK_CLASS}>{tc("marketplace")}</Link>}
              <Link href="/evenementen" className={FOOTER_LINK_CLASS}>{tc("events")}</Link>
              <Link href="/kaarten" className={FOOTER_LINK_CLASS}>{tc("cards")}</Link>
              <Link href="/verkopen" className={FOOTER_LINK_CLASS}>{tc("sell")}</Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("legal")}
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/privacy" className={FOOTER_LINK_CLASS}>{t("privacyPolicy")}</Link>
              <Link href="/voorwaarden" className={FOOTER_LINK_CLASS}>{t("terms")}</Link>
              <Link href="/support" className={FOOTER_LINK_CLASS}>{t("contact")}</Link>
            </div>
          </div>

          {/* Settings: theme/language toggles, anchored bottom-right */}
          <div className="flex flex-col items-end justify-end gap-2">
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Bottom bar: wettelijk verplichte bedrijfsgegevens + copyright.
            KvK/btw verschijnen pas zodra ze in platform-config.ts staan. */}
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          <address className="not-italic text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{PLATFORM.legalName}</span>
            {" · "}
            {formatPlatformAddress()}
            {" · "}
            <a href={`mailto:${PLATFORM.supportEmail}`} className="transition-colors hover:text-foreground">
              {PLATFORM.supportEmail}
            </a>
            {hasKvk() && <>{" · "}{t("kvk")}: {PLATFORM.kvkNumber}</>}
            {hasVat() && <>{" · "}{t("vat")}: {PLATFORM.vatId}</>}
          </address>
          <p className="shrink-0 text-xs text-muted-foreground">
            {t("copyright", { year: currentYear })}
          </p>
        </div>
      </PageContainer>
      </footer>
    </>
  );
}
