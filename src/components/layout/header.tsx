"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSession, SessionProvider } from "next-auth/react";
import { UserBalance } from "./user-balance";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, MessageCircle, Search } from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { SearchBar } from "@/components/search/search-bar";
import { CartIcon } from "@/components/ui/cart-icon";

function HeaderContent() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);

  useEffect(() => {
    function handleAvatarUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      setAvatarOverride(detail?.avatarUrl ?? null);
    }
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdate);
  }, []);

  const navLinks = [
    { href: "/veilingen" as const, label: t("auctions") },
    { href: "/claimsales" as const, label: t("claimsales") },
    { href: "/marktplaats" as const, label: t("marketplace") },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950 text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/images/logo-dark-mode.png"
            alt="Cards Center"
            width={120}
            height={34}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex ml-8">
          {navLinks.map((link) => {
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

        {/* Search bar — desktop */}
        <SearchBar variant="header" />

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-2">
          {session?.user ? (
            <div className="hidden items-center gap-2 md:flex">
              {/* Balance */}
              <UserBalance />

              {/* Notifications */}
              <NotificationBell />

              {/* Messages */}
              <Link
                href="/berichten"
                className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title={t("messages")}
              >
                <MessageCircle className="h-5 w-5" />
              </Link>

              {/* Cart */}
              <CartIcon />

              {/* Dashboard / Avatar */}
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
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
                {session.user.name}
              </Link>
            </div>
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
        <div className="border-t border-white/10 bg-slate-950 px-4 pb-4 pt-2 md:hidden">
          {/* Mobile search */}
          <MobileSearchBar />
          <nav className="mt-2 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {session?.user ? (
              <>
                <div className="px-4 py-3">
                  <UserBalance />
                </div>
                <Link
                  href="/berichten"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-md px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                  {t("messages")}
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-md px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                  {t("dashboard")} ({session.user.name})
                </Link>
              </>
            ) : (
              <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 rounded-md border border-white/20 px-4 py-3 text-center text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {t("register")}
                </Link>
              </div>
            )}
          </nav>
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
          className="w-full rounded-lg bg-white/10 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>
    </form>
  );
}

export function Header() {
  return (
    <SessionProvider>
      <HeaderContent />
    </SessionProvider>
  );
}
