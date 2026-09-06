"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession, SessionProvider } from "next-auth/react";
import { UserBalance } from "./user-balance";
import { useState, useEffect } from "react";
import { Menu, X, Bell, MessageCircle, ChevronRight } from "lucide-react";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MessageIcon } from "@/components/ui/message-icon";
import { CartIcon } from "@/components/ui/cart-icon";
import { AdminShield } from "@/components/layout/admin-shield";
import { ThemeIconButton } from "@/components/layout/theme-icon-button";
import { getUnreadCount } from "@/actions/notification";
import { getUnreadConversationCount } from "@/actions/message";
import { useRealtime } from "@/components/providers/realtime-provider";
import {
  HEADER_ICON_BTN,
  HEADER_PILL_GHOST,
  HEADER_PILL_LIGHT,
} from "./header-styles";

// Cleane header (sept 2026, naar de "Cards Center Home 2.0"-referentie):
// donkere band, logo links, platte nav-links met onderstreep-animatie,
// rechts ronde icoonknoppen (loep, thema, bel, admin, berichten, winkelwagen)
// en pillen (saldo, avatar / Registreren). Geen brand-bolletjes, geen divider.
// Alle functionaliteit van de vorige header blijft (SSE-badges, popovers,
// mobiel menu met quick-actions).

/** Desktop nav-link: platte tekst + onderstreep die van links inschuift. */
const NAV_LINK =
  "relative rounded-md px-2.5 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-2.5 after:bottom-1 2xl:px-3.5 2xl:text-[15px] 2xl:after:inset-x-3.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-[var(--nav-accent,currentColor)] after:transition-transform after:duration-200 after:ease-out hover:text-white hover:after:scale-x-100 motion-reduce:after:transition-none";

/** Mobiel nav-rij. */
const MOBILE_ROW =
  "flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors";

/** Brand-accent per handelscategorie: bolletje + onderstreep-kleur. */
// De onderstreep leest --nav-accent (fallback currentColor), zodat de
// kleur niet afhangt van de volgorde van after:bg-*-utilities in de CSS.
const ACCENT = {
  blue: { dot: "bg-blue-400", underline: "[--nav-accent:#60a5fa]" },
  amber: { dot: "bg-amber-400", underline: "[--nav-accent:#fbbf24]" },
  emerald: { dot: "bg-emerald-400", underline: "[--nav-accent:#34d399]" },
} as const;

function HeaderContent() {
  const t = useTranslations("common");
  const tn = useTranslations("notifications");
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { subscribe } = useRealtime();

  useEffect(() => {
    function handleAvatarUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      setAvatarOverride(detail?.avatarUrl ?? null);
    }
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdate);
  }, []);

  // Unread badges voor mobile-menu — 60s polling fallback + SSE realtime
  useEffect(() => {
    if (status !== "authenticated") return;
    getUnreadConversationCount().then(setUnreadMessages).catch(() => {});
    getUnreadCount().then(setUnreadNotifs).catch(() => {});
    const id = setInterval(() => {
      getUnreadConversationCount().then(setUnreadMessages).catch(() => {});
      getUnreadCount().then(setUnreadNotifs).catch(() => {});
    }, 60000);
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

  // Menu sluiten bij navigatie (bv. via back-knop): state aanpassen tijdens
  // render op een prop-wijziging (React-patroon, geen setState-in-effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileMenuOpen(false);
  }
  // Body-scroll vastzetten zolang het menu open is.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  // Eén platte lijst in de balk. De drie handelscategorieën houden hun eigen
  // brand-kleur (blauw/amber/groen — zelfde als hun pagina's) als klein
  // bolletje + gekleurde onderstreep; de overige links zijn neutraal.
  // "Verkopen" = verkopen aan Cards Center (inkoopservice), niet /dashboard/verkopen.
  const navLinks = [
    { href: "/veilingen" as const, label: t("auctions"), accent: "blue" as const },
    { href: "/claimsales" as const, label: t("claimsales"), accent: "amber" as const },
    { href: "/marktplaats" as const, label: t("marketplace"), accent: "emerald" as const },
    { href: "/evenementen" as const, label: t("events"), accent: null },
    { href: "/kaarten" as const, label: t("cards"), accent: null },
    { href: "/verkopen" as const, label: t("sell"), accent: null },
  ];

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const avatar = (size: "sm" | "md") => {
    const cls = size === "sm" ? "size-7" : "size-8";
    const src = avatarOverride || session?.user?.image;
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white/20`} />
    ) : (
      <span
        className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white`}
      >
        {session?.user?.name?.charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 text-white backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/85">
      <div className="mx-auto flex h-16 w-full max-w-[1880px] items-center gap-3 px-[clamp(1rem,3vw,4rem)] xl:h-[72px]">
        {/* Logo — plain <img>: de Next image-optimizer faalt op Railway. */}
        <Link href="/" className="flex shrink-0 items-center" aria-label="Cards Center — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-dark-mode.png"
            alt="Cards Center"
            width={160}
            height={45}
            className="h-9 w-auto xl:h-10"
          />
        </Link>

        {/* Desktop nav (vanaf xl — daaronder past de volle balk niet en toont de
            hamburger-header) — handelscategorieën links tegen het logo, de
            overige links rechts naast de acties (ml-auto op de tweede groep). */}
        <nav className="hidden items-center gap-0.5 xl:contents" aria-label="Hoofdmenu">
          {navLinks.map((link, i) => {
            const firstOfRightGroup = i === 3;
            const active = isActivePath(link.href);
            const a = link.accent ? ACCENT[link.accent] : null;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${NAV_LINK} ${a ? `inline-flex items-center gap-1.5 ${a.underline}` : ""} ${
                  active ? "text-white after:scale-x-100" : "text-white/70"
                } ${i === 0 ? "ml-3 2xl:ml-8" : ""} ${firstOfRightGroup ? "ml-auto" : ""}`}
              >
                {a && <span aria-hidden className={`inline-block size-1.5 rounded-full ${a.dot}`} />}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Acties */}
        <div className="ml-auto flex shrink-0 items-center gap-1 xl:ml-2 2xl:ml-3 2xl:gap-1.5">
          <GlobalSearch variant="desktop" />
          <span className="hidden xl:block">
            <ThemeIconButton />
          </span>

          {session?.user ? (
            <>
              {/* Saldo — altijd zichtbaar (mobiel + desktop) */}
              <UserBalance />

              {/* Desktop-only iconen */}
              <div className="hidden items-center gap-1 xl:flex 2xl:gap-1.5">
                <NotificationBell />
                <AdminShield />
                <MessageIcon />
              </div>

              <CartIcon />

              {/* Avatar → dashboard. Altijd zichtbaar; op mobiel/tablet alleen
                  het plaatje (ronde pil), de naam pas vanaf 2xl. Let op: geen
                  `hidden` combineren met de `inline-flex` uit HEADER_PILL_GHOST —
                  die twee display-utilities botsen (pil bleef op mobiel zichtbaar). */}
              <Link
                href="/dashboard"
                className={`${HEADER_PILL_GHOST} px-1 2xl:pr-3.5`}
                title={t("dashboard")}
                aria-label={t("dashboard")}
              >
                {avatar("md")}
                <span className="hidden max-w-[120px] truncate 2xl:inline">{session.user.name}</span>
              </Link>
            </>
          ) : (
            <div className="hidden items-center gap-1.5 xl:flex">
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t("login")}
              </Link>
              <Link href="/register" className={HEADER_PILL_LIGHT}>
                {t("register")}
              </Link>
            </div>
          )}

          {/* Mobiel: menu-knop */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`${HEADER_ICON_BTN} xl:hidden`}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobiel menu — full-height overlay onder de balk */}
      {mobileMenuOpen && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/[0.06] bg-slate-950 px-4 pb-6 pt-3 xl:hidden">
          <GlobalSearch variant="mobile" onNavigate={() => setMobileMenuOpen(false)} />

          {session?.user ? (
            <>
              {/* Quick-actions: berichten + meldingen (met badge) en dashboard */}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/berichten"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={`${t("messages")}${unreadMessages > 0 ? ` (${unreadMessages})` : ""}`}
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/15"
                >
                  <MessageCircle className="size-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard/meldingen"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={`${tn("title")}${unreadNotifs > 0 ? ` (${unreadNotifs})` : ""}`}
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/15"
                >
                  <Bell className="size-5" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="ml-auto flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white pl-1.5 pr-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                >
                  {avatar("sm")}
                  <span className="min-w-0 flex-1 truncate">{t("dashboard")}</span>
                  <ChevronRight className="size-4 shrink-0 opacity-60" />
                </Link>
              </div>
            </>
          ) : null}

          <nav className="mt-4 space-y-0.5" aria-label="Hoofdmenu">
            {navLinks.map((link) => {
              const active = isActivePath(link.href);
              const a = link.accent ? ACCENT[link.accent] : null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`${MOBILE_ROW} ${
                    active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {a && <span aria-hidden className={`inline-block size-2 rounded-full ${a.dot}`} />}
                  <span className="flex-1">{link.label}</span>
                  <ChevronRight className="size-4 opacity-40" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="text-xs font-medium text-white/50">Thema</span>
            <ThemeIconButton />
          </div>

          {!session?.user && (
            <div className="mt-3 flex gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/20 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className={`${HEADER_PILL_LIGHT} h-11 flex-1`}
              >
                {t("register")}
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Header() {
  return (
    <SessionProvider>
      <HeaderContent />
    </SessionProvider>
  );
}
