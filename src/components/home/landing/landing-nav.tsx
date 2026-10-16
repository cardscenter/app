"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CtaButton } from "@/components/ploy/cta-button";

export interface NavViewer {
  name: string;
  image: string | null;
}

const LINKS = [
  { href: "/evenementen", key: "navEvents" },
  { href: "/league", key: "navLeague" },
  { href: "/nieuws", key: "navNews" },
  { href: "/kaarten", key: "navCards" },
  { href: "/verkopen", key: "navSell" },
  { href: "/info", key: "navInfo" },
] as const;

const DESKTOP_LINK =
  "inline-flex h-full items-center text-[0.95rem] font-medium leading-none tracking-[-0.01em] text-[var(--cc-ink)]/70 no-underline transition-colors duration-200 hover:text-[var(--cc-ink)]";

/**
 * Zwevende pil-navigatie van de nieuwe homepage: gecentreerd bovenin, witte
 * pil met logo en links, rechts inloggen + rode actieknop. Onder 960px een
 * compacte pil links die uitklapt tot menu (zelfde patroon als de referentie).
 */
export function LandingNav({ viewer }: { viewer: NavViewer | null }) {
  const t = useTranslations("home.landing");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Menu dicht bij navigatie en bij Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const logo = (
    <Link href="/" aria-label="Cards Center" className="block shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-white-bg.png" alt="" width={120} height={40} className="h-7 w-auto" />
    </Link>
  );

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center md:top-6" aria-label="Hoofdmenu">
      <div className="flex w-full max-w-[1400px] items-start justify-between px-4 lg:px-8">
        {/* Mobiel/tablet: uitklappende pil */}
        <div className="pointer-events-auto relative h-12 min-[960px]:hidden">
          <div
            className={`absolute left-0 top-0 flex flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)] transition-[width,border-radius] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "w-[min(20rem,calc(100vw-2rem))]" : "w-[150px]"}`}
          >
            <div className="flex h-12 items-center gap-3 pl-4 pr-5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={open ? t("navClose") : "Menu"}
                onClick={() => setOpen((v) => !v)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--cc-ink)]/60 hover:bg-[var(--cc-bg)]"
              >
                {open ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              {logo}
            </div>
            <div
              id={menuId}
              aria-hidden={!open}
              className={`flex flex-col gap-1 overflow-hidden px-2 transition-[max-height,opacity,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "max-h-[520px] pb-3 pt-1 opacity-100" : "max-h-0 py-0 opacity-0"}`}
            >
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-[14px] px-3 py-3 text-[1.05rem] font-semibold leading-none text-[var(--cc-ink)]/80 no-underline hover:bg-[var(--cc-bg)] hover:text-[var(--cc-ink)]"
                >
                  {t(l.key)}
                </Link>
              ))}
              <div className="mt-1 border-t border-[var(--cc-border)] pt-2">
                {viewer ? (
                  <Link href="/dashboard" className="flex items-center gap-2 rounded-[14px] px-3 py-3 text-[1.05rem] font-semibold leading-none text-[var(--cc-ink)]/80 no-underline hover:bg-[var(--cc-bg)]">
                    <UserAvatar src={viewer.image} name={viewer.name} size="xs" /> {tc("dashboard")}
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="block rounded-[14px] px-3 py-3 text-[1.05rem] font-semibold leading-none text-[var(--cc-ink)]/80 no-underline hover:bg-[var(--cc-bg)]">
                      {tc("login")}
                    </Link>
                    <Link href="/register" className="block rounded-[14px] px-3 py-3 text-[1.05rem] font-semibold leading-none text-[var(--cc-red)] no-underline hover:bg-[var(--cc-red-soft)]">
                      {t("navCta")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: witte pil met logo + links */}
        <div className="pointer-events-auto hidden h-12 items-center rounded-full bg-white pl-5 pr-6 shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)] min-[960px]:flex">
          <span className="mr-8">{logo}</span>
          <div className="flex h-full items-center gap-7">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={DESKTOP_LINK}>
                {t(l.key)}
              </Link>
            ))}
          </div>
        </div>

        {/* Rechts: inloggen + actie */}
        <div className="pointer-events-auto flex h-12 items-center gap-3">
          {viewer ? (
            <Link
              href="/dashboard"
              className="cc-pill inline-flex h-12 items-center gap-2 bg-white pl-1.5 pr-4 text-sm font-semibold text-[var(--cc-ink)] no-underline shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)]"
            >
              <UserAvatar src={viewer.image} name={viewer.name} size="sm" />
              <span className="hidden sm:inline">{tc("dashboard")}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="cc-pill hidden h-12 items-center bg-white px-6 text-sm font-semibold text-[var(--cc-ink)] no-underline shadow-[0_8px_30px_-12px_rgba(32,32,32,0.35)] transition-colors hover:bg-[var(--cc-bg)] min-[540px]:inline-flex"
              >
                {tc("login")}
              </Link>
              <CtaButton href="/register" variant="red" className="h-12 !py-0 shadow-[0_8px_30px_-12px_rgba(140,20,32,0.5)]">
                {t("navCta")}
              </CtaButton>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
