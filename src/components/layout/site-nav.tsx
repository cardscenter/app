"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SessionProvider, useSession } from "next-auth/react";
import { Bell, ChevronRight, Menu, MessageCircle, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MessageIcon } from "@/components/ui/message-icon";
import { CartIcon } from "@/components/ui/cart-icon";
import { AdminShield } from "@/components/layout/admin-shield";
import { UserBalance } from "@/components/layout/user-balance";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getUnreadCount } from "@/actions/notification";
import { getUnreadConversationCount } from "@/actions/message";
import { useRealtime } from "@/components/providers/realtime-provider";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { CtaButton } from "@/components/ploy/cta-button";
import { HEADER_AVATAR_PILL, HEADER_PILL_SHADOW } from "./header-styles";

export interface NavViewer {
  name: string;
  image: string | null;
}

const DESKTOP_LINK =
  "inline-flex h-full items-center text-[0.95rem] font-medium leading-none tracking-[-0.01em] no-underline transition-colors duration-200 hover:text-[var(--foreground)]";
const MOBILE_LINK =
  "flex items-center justify-between rounded-[14px] px-3 py-3 text-[1.05rem] font-semibold leading-none text-[var(--foreground)]/80 no-underline hover:bg-[var(--background)] hover:text-[var(--foreground)]";

/**
 * Zwevende pil-navigatie van de hele site (design-pass 2026-10, Ploy-stijl).
 * Links een witte pil met logo en links, rechts een pil met zoeken, bel,
 * berichten, admin-schild (en bij flags: winkelwagen, saldo) plus de avatar;
 * uitgelogd "Inloggen" + rode actieknop. Onder 960px klapt de linker pil uit
 * tot menu met zoekveld, snelle acties (met ongelezen-tellers) en links.
 * Functioneel gelijk aan de vorige donkere header (SSE-badges, sessie-
 * verversing na avatar-wijziging, feature-flags op de handelslinks).
 * Het logo staat los van de pillen (2026-10-18): op mobiel gecentreerd boven
 * de pagina, op desktop links van de linkspil. Zodra de pagina scrolt veert
 * het omhoog uit beeld en schuift de linkspil naar links; helemaal bovenaan
 * komt het terug. Zelfde veer-easing als het footer-logo.
 * Het root-element is <header>: /bestellen en /keuken verbergen `body > header`.
 */
const LOGO_SPRING = { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] as const };
const LOGO_HIDE = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
/** Breedte van het desktop-logo (h-10 bij een 3:1-logo) plus de ruimte tot de pil. */
const DESKTOP_LOGO_SLOT = 120 + 20;
/** Vanaf hoeveel pixels scrollen het logo wegveert. */
const SCROLL_HIDE_AT = 24;

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}
const isScrolled = () => window.scrollY > SCROLL_HIDE_AT;
const isScrolledServer = () => false;
function SiteNavContent({ initialViewer }: { initialViewer: NavViewer | null }) {
  const t = useTranslations("common");
  const tn = useTranslations("nav");
  const tnotif = useTranslations("notifications");
  const pathname = usePathname();
  const { data: session, status, update: updateSession } = useSession();
  const features = useFeatureFlags();
  const { subscribe } = useRealtime();
  const [open, setOpen] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const menuId = useId();
  const reduced = useReducedMotion();

  // Logo verbergen zodra de pagina gescrold is; weer tonen helemaal bovenaan.
  const scrolled = useSyncExternalStore(subscribeScroll, isScrolled, isScrolledServer);
  const logoHidden = scrolled || open;
  const logoTransition = reduced ? { duration: 0 } : logoHidden ? LOGO_HIDE : LOGO_SPRING;

  // Eerste render uit de server-sessie, daarna neemt useSession het over.
  const viewer: NavViewer | null =
    status === "authenticated" && session?.user
      ? { name: session.user.name ?? "", image: session.user.image ?? null }
      : status === "loading"
        ? initialViewer
        : null;

  // Avatar/naam direct bijwerken na een profielwijziging en de JWT verversen.
  useEffect(() => {
    let cancelled = false;
    async function refreshSession() {
      try {
        await updateSession();
      } catch {
        return;
      }
      if (!cancelled) setAvatarOverride(undefined);
    }
    function handleAvatarUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      setAvatarOverride(detail?.avatarUrl ?? null);
      void refreshSession();
    }
    function handleSessionRefresh() {
      void refreshSession();
    }
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    window.addEventListener("session-refresh", handleSessionRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("avatar-updated", handleAvatarUpdate);
      window.removeEventListener("session-refresh", handleSessionRefresh);
    };
  }, [updateSession]);

  // Ongelezen-tellers voor het mobiele menu: 60s polling + SSE.
  useEffect(() => {
    if (status !== "authenticated") return;
    const load = () => {
      getUnreadConversationCount().then(setUnreadMessages).catch(() => {});
      getUnreadCount().then(setUnreadNotifs).catch(() => {});
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [status]);
  useEffect(() => {
    if (status !== "authenticated") return;
    const unsubM = subscribe("new-message", (event) => {
      if (event.type === "new-message") setUnreadMessages(event.payload.unreadConversationCount);
    });
    const unsubN = subscribe("notification-created", (event) => {
      if (event.type === "notification-created") setUnreadNotifs(event.payload.unreadCount);
    });
    return () => {
      unsubM();
      unsubN();
    };
  }, [status, subscribe]);

  // Menu dicht bij navigatie en Escape; body-scroll vast zolang open.
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
  useBodyScrollLock(open);

  // Handelslinks blijven, maar alleen zolang hun feature-flag zichtbaar is.
  const links = [
    { href: "/veilingen" as const, label: t("auctions"), show: features.FEATURE_AUCTIONS },
    { href: "/claimsales" as const, label: t("claimsales"), show: features.FEATURE_CLAIMSALES },
    { href: "/marktplaats" as const, label: t("marketplace"), show: features.FEATURE_MARKETPLACE },
    { href: "/evenementen" as const, label: t("events"), show: true },
    { href: "/league" as const, label: t("league"), show: true },
    { href: "/nieuws" as const, label: t("news"), show: true },
    { href: "/ervaringen" as const, label: t("experiences"), show: true },
    { href: "/kaarten" as const, label: t("cards"), show: features.FEATURE_CARD_DATABASE },
    { href: "/verkopen" as const, label: t("sell"), show: true },
    { href: "/info" as const, label: t("info"), show: true },
  ].filter((l) => l.show);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const avatarSrc = avatarOverride === undefined ? viewer?.image : avatarOverride;
  const logo = (sizeClass: string) => (
    <Link href="/" aria-label="Cards Center" className="block shrink-0" tabIndex={logoHidden ? -1 : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-white-bg.png" alt="" width={120} height={40} className={`${sizeClass} w-auto`} />
    </Link>
  );
  const pill = `bg-white ${HEADER_PILL_SHADOW}`;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center md:top-6">
      <div className="relative flex w-full max-w-[1400px] items-start justify-between gap-3 px-4 lg:px-8">
        {/* Mobiel/tablet: los logo in het midden, veert omhoog weg bij scrollen of open menu */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-12 items-center justify-center min-[960px]:hidden" aria-hidden={logoHidden}>
          <motion.div
            initial={false}
            animate={logoHidden ? { y: -56, opacity: 0, scale: 0.9 } : { y: 0, opacity: 1, scale: 1 }}
            transition={logoTransition}
            className={logoHidden ? "pointer-events-none" : "pointer-events-auto"}
          >
            {logo("h-11 min-[400px]:h-12")}
          </motion.div>
        </div>

        {/* Mobiel/tablet: uitklappende pil met menu */}
        <div className="pointer-events-auto relative h-12 min-[960px]:hidden">
          <div
            className={`absolute left-0 top-0 flex flex-col overflow-hidden rounded-[24px] ${pill} transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "w-[min(22rem,calc(100vw-2rem))]" : "w-12"}`}
          >
            <div className="flex h-12 items-center px-1.5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={open ? tn("close") : tn("menu")}
                onClick={() => setOpen((v) => !v)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground)]/60 hover:bg-[var(--background)]"
              >
                {open ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
            <div
              id={menuId}
              aria-hidden={!open}
              className={`flex flex-col gap-1 overflow-y-auto px-2 transition-[max-height,opacity,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "max-h-[calc(100dvh-7rem)] pb-3 pt-1 opacity-100" : "max-h-0 py-0 opacity-0"}`}
            >
              {/* Actierij: loep (klapt uit over de rij heen), berichten, meldingen,
                  dashboard. De key zorgt dat de zoekbalk ingeklapt begint bij elk openen. */}
              <div className="relative mt-1 flex items-center gap-2 px-1">
                <GlobalSearch key={open ? "open" : "closed"} variant="mobile" onNavigate={() => setOpen(false)} />
                {viewer && (
                  <>
                  <Link
                    href="/berichten"
                    onClick={() => setOpen(false)}
                    aria-label={`${t("messages")}${unreadMessages > 0 ? ` (${unreadMessages})` : ""}`}
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-[var(--foreground)]/75 hover:bg-[var(--muted)]"
                  >
                    <MessageCircle className="size-5" />
                    {unreadMessages > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/dashboard/meldingen"
                    onClick={() => setOpen(false)}
                    aria-label={`${tnotif("title")}${unreadNotifs > 0 ? ` (${unreadNotifs})` : ""}`}
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-[var(--foreground)]/75 hover:bg-[var(--muted)]"
                  >
                    <Bell className="size-5" />
                    {unreadNotifs > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadNotifs > 9 ? "9+" : unreadNotifs}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="ml-auto flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[var(--foreground)] pl-1.5 pr-4 text-sm font-semibold text-white no-underline"
                  >
                    <UserAvatar src={avatarSrc} name={viewer.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{t("dashboard")}</span>
                    <ChevronRight className="size-4 shrink-0 opacity-60" />
                  </Link>
                  </>
                )}
              </div>
              <nav className="mt-1 flex flex-col gap-0.5" aria-label={tn("mainMenu")}>
                {links.map((l) => (
                  <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={`${MOBILE_LINK} ${isActive(l.href) ? "bg-[var(--background)] text-[var(--foreground)]" : ""}`}>
                    <span>{l.label}</span>
                    <ChevronRight className="size-4 opacity-35" />
                  </Link>
                ))}
              </nav>
              <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-3 pt-3">
                <span className="text-xs font-medium text-[var(--foreground)]/50">{tn("language")}</span>
                <LanguageSwitcher />
              </div>
              {!viewer && (
                <div className="mt-2 flex gap-2 px-1 pb-1">
                  <Link href="/login" onClick={() => setOpen(false)} className="flex h-11 flex-1 items-center justify-center rounded-full border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] no-underline hover:bg-[var(--background)]">
                    {t("login")}
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white no-underline hover:bg-[var(--primary-hover)]">
                    {tn("cta")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop: los logo links, daarnaast de witte pil met links. Bij scrollen
            verdwijnt het logo omhoog en schuift de pil naar links in zijn plaats. */}
        <div className="hidden h-12 items-center min-[960px]:flex">
          <motion.div
            initial={false}
            animate={logoHidden ? { width: 0, opacity: 0, y: -40 } : { width: DESKTOP_LOGO_SLOT, opacity: 1, y: 0 }}
            transition={logoTransition}
            className={`flex h-12 shrink-0 items-center overflow-hidden ${logoHidden ? "pointer-events-none" : "pointer-events-auto"}`}
            aria-hidden={logoHidden}
          >
            {logo("h-10")}
          </motion.div>
          <nav className={`pointer-events-auto flex h-12 items-center rounded-full px-6 ${pill}`} aria-label={tn("mainMenu")}>
            <div className="flex h-full items-center gap-6 xl:gap-7">
              {links.map((l) => (
                <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={`${DESKTOP_LINK} ${isActive(l.href) ? "text-[var(--foreground)]" : "text-[var(--foreground)]/70"}`}>
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* Rechts: acties */}
        <div className="pointer-events-auto flex h-12 shrink-0 items-center gap-2 sm:gap-3">
          {viewer ? (
            <>
              <div className={`hidden h-12 items-center gap-0.5 rounded-full px-1.5 ${pill} min-[960px]:flex`}>
                <GlobalSearch variant="desktop" />
                <NotificationBell />
                <AdminShield />
                <MessageIcon />
                {features.FEATURE_CLAIMSALES && <CartIcon />}
              </div>
              {features.FEATURE_WALLET && <UserBalance />}
              <Link href="/dashboard" className={`${HEADER_AVATAR_PILL} pl-1.5 pr-1.5 min-[1100px]:pr-4`} title={t("dashboard")} aria-label={t("dashboard")}>
                <UserAvatar src={avatarSrc} name={viewer.name} size="sm" emphasis />
                <span className="hidden max-w-[140px] truncate min-[1100px]:inline">{t("dashboard")}</span>
              </Link>
            </>
          ) : (
            <>
              <div className={`hidden h-12 items-center rounded-full px-1.5 ${pill} min-[960px]:flex`}>
                <GlobalSearch variant="desktop" />
              </div>
              <Link href="/login" className={`inline-flex h-12 items-center rounded-full px-4 min-[400px]:px-5 min-[960px]:px-6 text-sm font-semibold text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--background)] ${pill}`}>
                {t("login")}
              </Link>
              {/* De rode actieknop alleen op brede schermen: op mobiel staat het logo in
                  het midden en zit "Account aanmaken" in het uitklapmenu; tussen 960 en
                  1100px past hij niet naast het losse logo. */}
              <span className="hidden min-[1100px]:inline-flex">
                <CtaButton href="/register" variant="red" className="h-12 !py-0 shadow-[0_8px_30px_-12px_rgba(140,20,32,0.5)]">
                  {tn("cta")}
                </CtaButton>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteNav({ initialViewer }: { initialViewer: NavViewer | null }) {
  return (
    <SessionProvider>
      <SiteNavContent initialViewer={initialViewer} />
    </SessionProvider>
  );
}
