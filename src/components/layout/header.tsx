"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSession, SessionProvider } from "next-auth/react";
import { UserBalance } from "./user-balance";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Search, Bell, MessageCircle, ChevronRight } from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MessageIcon } from "@/components/ui/message-icon";
import { CartIcon } from "@/components/ui/cart-icon";
import { AdminShield } from "@/components/layout/admin-shield";
import { getUnreadCount } from "@/actions/notification";
import { getUnreadConversationCount } from "@/actions/message";
import { useRealtime } from "@/components/providers/realtime-provider";

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

  // Primary sections get subtle brand accents matching their page colors
  // (blue / amber / emerald). "Kaarten" and any later additions are
  // secondary — separated by a vertical divider.
  const primaryLinks = [
    { href: "/veilingen" as const, label: t("auctions"),    accent: "blue" as const },
    { href: "/claimsales" as const, label: t("claimsales"), accent: "amber" as const },
    { href: "/marktplaats" as const, label: t("marketplace"), accent: "emerald" as const },
  ];
  // Secondary sections — geen brand-accent/bolletje, achter de divider.
  const secondaryLinks = [
    { href: "/evenementen" as const, label: t("events") },
    { href: "/kaarten" as const, label: t("cards") },
  ];

  const accentClasses: Record<"blue" | "amber" | "emerald", { active: string; idle: string; dot: string }> = {
    blue:    { active: "bg-blue-500/15 text-blue-100",       idle: "text-slate-300 hover:bg-blue-500/10 hover:text-blue-200",       dot: "bg-blue-400" },
    amber:   { active: "bg-amber-500/15 text-amber-100",     idle: "text-slate-300 hover:bg-amber-500/10 hover:text-amber-200",     dot: "bg-amber-400" },
    emerald: { active: "bg-emerald-500/15 text-emerald-100", idle: "text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-200", dot: "bg-emerald-400" },
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/95 text-white backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/85">
      <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* Logo — plain <img>: de Next image-optimizer faalt op Railway, dus
            net als elders in de app serveren we het statische bestand direct. */}
        <Link href="/" className="mr-2 flex shrink-0 items-center gap-2 lg:mr-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-dark-mode.png"
            alt="Cards Center"
            width={160}
            height={45}
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {primaryLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            const a = accentClasses[link.accent];
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? a.active : a.idle
                }`}
              >
                <span className={`inline-block size-1.5 rounded-full ${a.dot}`} />
                {link.label}
              </Link>
            );
          })}

          {/* Divider separating primary sections from auxiliary links */}
          <span aria-hidden className="mx-2 h-5 w-px bg-white/15" />

          {secondaryLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side — ml-auto duwt alles naar rechts; de nav neemt links de
            ruimte. De zoekbalk is een loep-icoon dat naar links openklapt. */}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
          {/* Zoeken: loep-icoon dat over de nav heen naar links uitklapt (md+) */}
          <HeaderSearchToggle />

          {session?.user ? (
            <>
              {/* Saldo — ALTIJD zichtbaar (mobile + desktop). Click-popover
                  toont beschikbaar/vastgehouden/totaal saldo. */}
              <UserBalance />

              {/* Desktop-only iconen: notifications, admin, messages */}
              <div className="hidden items-center gap-1 md:flex md:gap-1.5">
                <NotificationBell />
                <AdminShield />
                <MessageIcon />
              </div>

              {/* Winkelwagen — ALTIJD zichtbaar (mobile + desktop) */}
              <CartIcon />

              {/* Dashboard / Avatar — desktop-only (mobile heeft 'm in menu) */}
              <Link
                href="/dashboard"
                className="ml-1 hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20 md:flex"
              >
                {(avatarOverride || session.user.image) ? (
                  <img
                    src={avatarOverride || session.user.image!}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {session.user.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="max-w-[120px] truncate">{session.user.name}</span>
              </Link>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {t("register")}
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-slate-950 px-4 pb-5 pt-3 md:hidden">
          {/* Mobile search */}
          <MobileSearchBar />

          {session?.user ? (
            <>
              {/* QUICK ACTIONS — Berichten + Meldingen icons (met unread-badge)
                  links, Dashboard-pill rechts. Tap navigeert direct, geen
                  popover (popovers worden door header-bell/icon op desktop
                  afgehandeld). */}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/berichten"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={`${t("messages")}${unreadMessages > 0 ? ` (${unreadMessages})` : ""}`}
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition-colors hover:bg-white/15"
                >
                  <MessageCircle className="size-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>

                <Link
                  href="/dashboard/meldingen"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={`${tn("title")}${unreadNotifs > 0 ? ` (${unreadNotifs})` : ""}`}
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition-colors hover:bg-white/15"
                >
                  <Bell className="size-5" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </Link>

                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="ml-auto flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover px-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40"
                >
                  {(avatarOverride || session.user.image) ? (
                    <img
                      src={avatarOverride || session.user.image!}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-white/30"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate">{t("dashboard")}</span>
                  <ChevronRight className="size-4 shrink-0 opacity-80" />
                </Link>
              </div>

              {/* Section label */}
              <p className="mt-5 mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Categorieën
              </p>

              {/* Primary nav cards — gekleurde bolletjes + active-state highlight */}
              <nav className="space-y-1">
                {primaryLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  const a = accentClasses[link.accent];
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`group/menu flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                        isActive ? a.active : a.idle
                      }`}
                    >
                      <span
                        className={`relative inline-flex size-2.5 shrink-0 rounded-full ${a.dot}`}
                        aria-hidden
                      >
                        {isActive && (
                          <span className={`absolute inset-0 animate-ping rounded-full ${a.dot} opacity-60`} />
                        )}
                      </span>
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight className="size-4 opacity-40 transition-opacity group-hover/menu:opacity-70" />
                    </Link>
                  );
                })}
              </nav>

              {/* Secondary — Kaarten en eventuele extra */}
              {secondaryLinks.length > 0 && (
                <>
                  <p className="mt-5 mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Overig
                  </p>
                  <nav className="space-y-1">
                    {secondaryLinks.map((link) => {
                      const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-white/15 text-white"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="flex-1">{link.label}</span>
                          <ChevronRight className="size-4 opacity-40" />
                        </Link>
                      );
                    })}
                  </nav>
                </>
              )}
            </>
          ) : (
            <>
              {/* Logged-out: primary + secondary nav, dan login/register-knoppen */}
              <p className="mt-4 mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Categorieën
              </p>
              <nav className="space-y-1">
                {primaryLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  const a = accentClasses[link.accent];
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                        isActive ? a.active : a.idle
                      }`}
                    >
                      <span className={`inline-block size-2.5 shrink-0 rounded-full ${a.dot}`} />
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight className="size-4 opacity-40" />
                    </Link>
                  );
                })}
                {secondaryLinks.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight className="size-4 opacity-40" />
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-sm font-medium text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover"
                >
                  {t("register")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function MobileSearchBar() {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/zoeken?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg bg-white/10 pl-9 pr-3 py-2.5 text-base text-white placeholder:text-slate-400 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>
    </form>
  );
}

// Zoek-loep die op desktop (md+) naar links openklapt over de nav heen.
// Klik buiten de balk of Escape klapt 'm weer in.
function HeaderSearchToggle() {
  const t = useTranslations("search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/zoeken?q=${encodeURIComponent(trimmed)}`);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative hidden md:flex md:items-center">
      {/* Loep-trigger — verborgen zodra de balk open is zodat alleen de balk telt */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("placeholder")}
        className={`rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Uitklappende zoekbalk — geanimeerd naar links, over de nav heen */}
      <form
        onSubmit={handleSubmit}
        className={`absolute right-0 top-1/2 z-50 flex -translate-y-1/2 items-center overflow-hidden rounded-lg bg-slate-800/95 shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 ease-out ${
          open ? "w-[min(70vw,400px)] opacity-100" : "pointer-events-none w-0 opacity-0"
        }`}
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          tabIndex={open ? 0 : -1}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-white placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setValue(""); }}
          tabIndex={open ? 0 : -1}
          aria-label="Sluit"
          className="mr-1 shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <SessionProvider>
      <HeaderContent />
    </SessionProvider>
  );
}
