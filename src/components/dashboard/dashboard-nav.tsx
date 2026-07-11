"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { signOut } from "next-auth/react";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  LayoutDashboard,
  BarChart3,
  Gavel,
  Tag,
  ShoppingBag,
  Store,
  CalendarDays,
  Heart,
  Bell,
  Wallet,
  User,
  Star,
  Package,
  Truck,
  Scale,
  CreditCard,
  ShieldCheck,
  Paintbrush,
  Menu,
  X,
  ArrowDownToLine,
  LogOut,
  Ban,
  Shield,
  HandCoins,
  Banknote,
  ChevronDown,
} from "lucide-react";

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
  /** Toon een pulserend rood "Live"-bolletje achter de label (Live Hub). */
  liveIndicator?: boolean;
  /** Live-count badge naast de label. Hidden bij 0 of undefined. */
  badge?: number;
};

// A group with `labelKey` collapses behind a chevron-button header. Without
// `labelKey` the items render as plain top/bottom links (used for Overzicht +
// Personalisatie/Geschillen).
type NavGroup = {
  id: string;
  labelKey?: string;
  items: NavItem[];
};

interface LevelInfo {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress: number;
  nextLevelName: string | null;
}

type DashboardNavProps = {
  accountType?: string;
  level?: LevelInfo;
  adminPendingCounts?: { disputes?: number; verifications?: number; withdrawals?: number; buybacks?: number; reports?: number; sellerWarnings?: number; enterpriseRequests?: number };
  /** Live counts voor de "offer"-groep — auctions = ACTIVE+SCHEDULED,
   *  claimsales = LIVE+SCHEDULED, listings = ACTIVE, events = alles behalve
   *  DELETED (0 = nav-item verborgen). */
  counts?: { auctions: number; listings: number; claimsales: number; events?: number };
};

const OPEN_STATE_STORAGE_KEY = "dashboard-nav-open";

// Thin wrapper: decides which nav to render based on path + admin status.
// Splitting the swap from the inner component avoids React reconciliation
// confusion (the inner DashboardNavInner has many hooks, AdminNav has 3 —
// keeping them as siblings instead of a parent-with-early-return makes
// hook-counts stable per fiber).
export function DashboardNav(props: DashboardNavProps) {
  const pathname = usePathname();
  if (props.accountType === "ADMIN" && pathname.startsWith("/dashboard/admin")) {
    return <AdminNav pendingCounts={props.adminPendingCounts} />;
  }
  return <DashboardNavInner {...props} />;
}

function DashboardNavInner({ accountType, level, counts }: DashboardNavProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const isAdmin = accountType === "ADMIN";

  function handleLogoutClick() {
    if (confirmLogout) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      signOut({ callbackUrl: "/" });
      return;
    }
    setConfirmLogout(true);
    confirmTimerRef.current = setTimeout(() => setConfirmLogout(false), 4000);
  }

  const groups: NavGroup[] = useMemo(
    () => [
      {
        id: "overview",
        items: [
          { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
          { href: "/dashboard/statistieken", labelKey: "myStatistics", icon: BarChart3 },
        ],
      },
      {
        id: "offer",
        labelKey: "sectionOffer",
        items: [
          { href: "/dashboard/veilingen", labelKey: "myAuctions", icon: Gavel, badge: counts?.auctions },
          { href: "/dashboard/claimsales", labelKey: "myClaimsales", icon: Tag, badge: counts?.claimsales },
          { href: "/dashboard/marktplaats", labelKey: "myListings", icon: Store, badge: counts?.listings },
          // Alleen zichtbaar als de user ooit een event heeft aangemaakt
          // (PENDING/LIVE/REJECTED/ENDED — deep-link blijft altijd werken).
          ...(counts?.events
            ? [{ href: "/dashboard/evenementen", labelKey: "myEvents", icon: CalendarDays, badge: counts.events }]
            : []),
        ],
      },
      {
        id: "orders",
        labelKey: "sectionOrders",
        items: [
          { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag },
          { href: "/dashboard/verkopen", labelKey: "mySales", icon: Package },
        ],
      },
      {
        id: "activity",
        labelKey: "sectionActivity",
        items: [
          { href: "/dashboard/biedingen", labelKey: "myBids", icon: HandCoins, liveIndicator: true },
          { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart },
          { href: "/dashboard/meldingen", labelKey: "myNotifications", icon: Bell },
        ],
      },
      {
        id: "wallet",
        labelKey: "sectionWallet",
        items: [
          { href: "/dashboard/saldo", labelKey: "myBalance", icon: Wallet },
          { href: "/dashboard/uitbetalingen", labelKey: "myWithdrawals", icon: Banknote },
          { href: "/dashboard/inkoop", labelKey: "myBuyback", icon: ArrowDownToLine },
        ],
      },
      {
        id: "account",
        labelKey: "sectionAccount",
        items: [
          { href: "/dashboard/profiel", labelKey: "profile", icon: User },
          { href: "/dashboard/verificatie", labelKey: "myVerification", icon: ShieldCheck },
          { href: "/dashboard/abonnement", labelKey: "mySubscription", icon: CreditCard },
          { href: "/dashboard/verzending", labelKey: "myShipping", icon: Truck },
          { href: "/dashboard/reviews", labelKey: "myReviews", icon: Star },
          { href: "/dashboard/blokkeerlijst", labelKey: "myBlockedList", icon: Ban },
        ],
      },
      {
        id: "extras",
        items: [
          { href: "/customization", labelKey: "personalization", icon: Paintbrush, comingSoon: true },
          { href: "/dashboard/geschillen", labelKey: "myDisputes", icon: Scale },
        ],
      },
    ],
    [counts]
  );

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }

  // Which collapsible group contains the active route? That one is always open.
  const activeGroupId = useMemo(() => {
    return groups.find((g) => g.labelKey && g.items.some((item) => isActive(item.href)))?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, groups]);

  // "offer" en "orders" zijn de meest-gebruikte secties — die staan altijd
  // open na een refresh, tenzij de user ze expliciet inklapt (localStorage).
  // De actieve sectie wordt áltijd geforceerd open, ook als user 'm gesloten
  // had — anders zien ze hun huidige page-link niet.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { offer: true, orders: true };
    if (activeGroupId) initial[activeGroupId] = true;
    return initial;
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPEN_STATE_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Record<string, boolean>;
        setOpenSections((prev) => {
          // stored overschrijft defaults zodat user-close-keuze persist
          const merged = { ...prev, ...stored };
          if (activeGroupId) merged[activeGroupId] = true;
          return merged;
        });
      }
    } catch {
      // ignore — corrupt JSON of geen localStorage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force the active section open on navigation.
  useEffect(() => {
    if (activeGroupId) {
      setOpenSections((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(OPEN_STATE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Active item for mobile compact-bar header
  const allItems = groups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => isActive(item.href)) ?? allItems[0];
  const ActiveIcon = activeItem.icon;

  const isLevelActive = pathname === "/dashboard/level";

  const levelCard = level && (
    <Link
      href="/dashboard/level"
      onClick={() => setMobileOpen(false)}
      className={`block rounded-xl border p-3 transition-all ${
        isLevelActive
          ? `${level.bgColor} ${level.borderColor} ring-2 ring-primary/30`
          : `${level.bgColor} ${level.borderColor} hover:ring-1 hover:ring-primary/20`
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{level.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{t("myLevel")}</p>
          <p className={`text-sm font-bold truncate ${level.color}`}>{level.name}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${level.progress}%` }}
        />
      </div>
    </Link>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogoutClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
        confirmLogout
          ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
      }`}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {confirmLogout ? tc("logoutConfirm") : tc("logout")}
    </button>
  );

  const adminPanelButton = isAdmin ? (
    <Link
      href="/dashboard/admin"
      onClick={() => setMobileOpen(false)}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 transition-all hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
    >
      <Shield className="h-4 w-4 shrink-0" />
      {t("adminPanel")}
    </Link>
  ) : null;

  function renderItem(item: NavItem) {
    const Icon = item.icon;

    if (item.comingSoon) {
      return (
        <div
          key={item.href}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
          aria-disabled="true"
          title="Binnenkort beschikbaar"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t(item.labelKey)}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            Soon
          </span>
        </div>
      );
    }

    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
          active
            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {item.liveIndicator ? (
          // Live-bolletje vervangt het icoon voor de Live Hub. Wordt gehouden
          // op dezelfde 4×4-slot zodat de label-uitlijning gelijk loopt met
          // andere nav-items in dezelfde groep.
          <span
            className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
            aria-label="Live"
          >
            <span
              className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-rose-500 opacity-75"
              aria-hidden="true"
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        ) : (
          <Icon className="h-4 w-4 shrink-0" />
        )}
        <span className="flex-1 truncate">{t(item.labelKey)}</span>
        {typeof item.badge === "number" && item.badge > 0 && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              active
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  const navLinks = groups.map((group, idx) => {
    if (!group.labelKey) {
      // Flat group — no header, no collapse. Add a small top divider when it's
      // a bottom-block (the "extras" group after the collapsible groups).
      const isBottomFlat = idx > 0 && groups[idx - 1].labelKey != null;
      return (
        <div key={group.id} className={isBottomFlat ? "mt-2 border-t border-border pt-2 space-y-0.5" : "space-y-0.5"}>
          {group.items.map(renderItem)}
        </div>
      );
    }

    const isOpen = !!openSections[group.id];
    const groupHasActive = group.items.some((item) => isActive(item.href));

    return (
      <div key={group.id} className="mt-1">
        <button
          type="button"
          onClick={() => toggleSection(group.id)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            groupHasActive ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"
          }`}
          aria-expanded={isOpen}
        >
          <span>{t(group.labelKey)}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? "" : "-rotate-90"}`}
          />
        </button>
        {isOpen && <div className="mt-0.5 space-y-0.5">{group.items.map(renderItem)}</div>}
      </div>
    );
  });

  return (
    <>
      {/* Mobile: compact bar + expandable menu */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="glass-nav flex w-full items-center justify-between rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <ActiveIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t(activeItem.labelKey)}</span>
          </div>
          {mobileOpen ? (
            <X className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {mobileOpen && (
          <>
            <div className="glass-nav mt-2 rounded-xl p-2 space-y-0.5">
              {levelCard && <div className="mb-2">{levelCard}</div>}
              {navLinks}
            </div>
            {adminPanelButton && <div className="mt-3">{adminPanelButton}</div>}
            <div className="mt-3">{logoutButton}</div>
          </>
        )}
      </div>

      {/* Desktop: full sidebar */}
      <div className="hidden md:block">
        <nav className="glass-nav rounded-xl p-2 space-y-0.5">
          {levelCard && <div className="mb-2">{levelCard}</div>}
          {navLinks}
        </nav>
        {adminPanelButton && <div className="mt-3">{adminPanelButton}</div>}
        <div className="mt-3">{logoutButton}</div>
      </div>
    </>
  );
}
