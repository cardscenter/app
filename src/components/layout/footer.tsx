"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ThemeToggle } from "@/components/toggle-theme";
import { LanguageSwitcher } from "./language-switcher";

export function Footer() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/veilingen"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tc("auctions")}
              </Link>
              <Link
                href="/claimsales"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tc("claimsales")}
              </Link>
              <Link
                href="/marktplaats"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tc("marketplace")}
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("legal")}
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("privacyPolicy")}
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("terms")}
              </Link>
            </div>
          </div>

          {/* Settings: Finn & Sage + caption + theme/language toggles, all anchored bottom-right */}
          <div className="flex flex-col items-end justify-end gap-2">
            {/* Finn & Sage — decorative, desktop only, stuck upward so it peeks over the footer top edge */}
            <div className="pointer-events-none hidden lg:block lg:-mt-24" aria-hidden="true">
              <Image
                src="/images/mascotte/footer/footer.png"
                alt=""
                width={280}
                height={348}
                sizes="280px"
                className="drop-shadow-xl"
                style={{ width: 280, height: 348, maxWidth: "none" }}
                priority={false}
              />
              <p
                className="-mt-6 text-center text-xs font-medium italic text-muted-foreground"
                style={{ width: 280 }}
              >
                {t("mascotCaption")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {t("copyright", { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  );
}
