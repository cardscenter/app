"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { signOut } from "next-auth/react";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  LayoutDashboard,
  BarChart3,
  ShoppingBag,
  Store,
  Heart,
  Wallet,
  User,
  Star,
  Package,
  Truck,
  Scale,
  CreditCard,
  ShieldCheck,
  Settings,
  Menu,
  X,
  ArrowDownToLine,
  LogOut,
  Shield,
  HandCoins,
  LifeBuoy,
  ChevronsUpDown,
  ChevronDown,
} from "lucide-react";

// Sidebar in fintech-stijl (sept 2026, naar de Sequence-referentie): een
// volledige kolom met eigen achtergrond (bg-card + rechterrand, in de layout),
// platte groepen met kleine uppercase-labels, actieve rij als zachte pil.
// Account is één uitklaprij met chevron (zoals "Cards" in de referentie) zodat
// de lijst kort blijft; onderaan Help/Uitloggen, de gebruikerskaart met
// level-voortgang en een copyright-regel. Geen localStorage, geen intern scrollen.
// De AdminNav-swap voor /dashboard/admin/* blijft ongewijzigd.

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
  /** Toon een pulserend rood "Live"-bolletje i.p.v. het icoon (Live Hub). */
  liveIndicator?: boolean;
  /** Live-count badge naast de label. Hidden bij 0 of undefined. */
  badge?: number;
  /** Extra route-prefixes waarop dit item ook actief is (cluster-tabs). */
  match?: string[];
};

type NavGroup = {
  id: string;
  labelKey: string;
  items: NavItem[];
  /** Render de groep als één uitklaprij (icoon + label + chevron) i.p.v. een sectie. */
  collapsible?: { icon: typeof LayoutDashboard };
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
  /** Voor de gebruikerskaart onderaan. */
  user?: { name: string; email: string | null; image: string | null };
  adminPendingCounts?: {
    disputes?: number;
    verifications?: number;
    withdrawals?: number;
    buybacks?: number;
    reports?: number;
    sellerWarnings?: number;
    enterpriseRequests?: number;
  };
  /** Live counts voor het Aanbod-item — auctions = ACTIVE+SCHEDULED,
   *  claimsales = LIVE+SCHEDULED, listings = ACTIVE, events = niet-DELETED. */
  counts?: { auctions: number; listings: number; claimsales: number; events?: number };
};

// Thin wrapper: admin-routes krijgen de AdminNav (aparte hook-set, dus als
// sibling i.p.v. early-return binnen één component).
export function DashboardNav(props: DashboardNavProps) {
  const pathname = usePathname();
  if (props.accountType === "ADMIN" && pathname.startsWith("/dashboard/admin")) {
    return <AdminNav pendingCounts={props.adminPendingCounts} />;
  }
  return <DashboardNavInner {...props} />;
}

const ROW =
  "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors";
const ROW_ACTIVE = "bg-primary/10 text-primary dark:bg-primary/20";
const ROW_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";

function DashboardNavInner({ accountType, level, user, counts }: DashboardNavProps) {
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

  // Mobiel menu sluiten bij navigatie (state-aanpassing tijdens render).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }

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

  const offerBadge =
    (counts?.auctions ?? 0) +
    (counts?.claimsales ?? 0) +
    (counts?.listings ?? 0) +
    (counts?.events ?? 0);

  const groups: NavGroup[] = useMemo(
    () => [
      {
        id: "general",
        labelKey: "sectionGeneral",
        items: [
          { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
          { href: "/dashboard/statistieken", labelKey: "myStatistics", icon: BarChart3 },
          {
            href: "/dashboard/saldo",
            labelKey: "navFinance",
            icon: Wallet,
            match: ["/dashboard/uitbetalingen"],
          },
        ],
      },
      {
        id: "selling",
        labelKey: "sectionSales",
        items: [
          {
            href: "/dashboard/veilingen",
            labelKey: "navOffer",
            icon: Store,
            badge: offerBadge,
            match: ["/dashboard/claimsales", "/dashboard/marktplaats", "/dashboard/evenementen"],
          },
          { href: "/dashboard/verkopen", labelKey: "mySales", icon: Package },
          { href: "/dashboard/inkoop", labelKey: "myBuyback", icon: ArrowDownToLine },
        ],
      },
      {
        id: "buying",
        labelKey: "sectionBuying",
        items: [
          { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag },
          { href: "/dashboard/biedingen", labelKey: "myBids", icon: HandCoins, liveIndicator: true },
          { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart },
          { href: "/dashboard/geschillen", labelKey: "myDisputes", icon: Scale },
        ],
      },
      {
        id: "account",
        labelKey: "sectionAccount",
        collapsible: { icon: User },
        items: [
          { href: "/dashboard/profiel", labelKey: "profile", icon: User },
          {
            href: "/dashboard/instellingen",
            labelKey: "mySettings",
            icon: Settings,
            match: ["/dashboard/blokkeerlijst"],
          },
          { href: "/dashboard/verzending", labelKey: "myShipping", icon: Truck },
          { href: "/dashboard/verificatie", labelKey: "myVerification", icon: ShieldCheck },
          { href: "/dashboard/abonnement", labelKey: "mySubscription", icon: CreditCard },
          { href: "/dashboard/reviews", labelKey: "myReputation", icon: Star, match: ["/dashboard/level"] },
        ],
      },
    ],
    [offerBadge],
  );

  function isPathActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }
  function isActive(item: NavItem) {
    if (isPathActive(item.href)) return true;
    return item.match?.some((m) => isPathActive(m)) ?? false;
  }

  // Account-uitklaprij: open zolang een kind actief is, anders handmatig.
  const accountActive = groups.find((g) => g.id === "account")?.items.some((i) => isActive(i)) ?? false;
  const [accountOpenManual, setAccountOpenManual] = useState<boolean | null>(null);
  const accountOpen = accountOpenManual ?? accountActive;

  const allItems = groups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => isActive(item)) ?? allItems[0];
  const ActiveIcon = activeItem.icon;

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    if (item.comingSoon) {
      return (
        <div
          key={item.href}
          className={`${ROW} cursor-not-allowed text-muted-foreground/60`}
          aria-disabled="true"
          title="Binnenkort beschikbaar"
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{t(item.labelKey)}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Soon
          </span>
        </div>
      );
    }
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE}`}
      >
        {item.liveIndicator ? (
          <span className="relative inline-flex size-4 shrink-0 items-center justify-center" aria-label="Live">
            <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-rose-500 opacity-75" aria-hidden />
            <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
          </span>
        ) : (
          <Icon className={`size-4 shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`} />
        )}
        <span className="flex-1 truncate">{t(item.labelKey)}</span>
        {typeof item.badge === "number" && item.badge > 0 && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  const navGroups = groups.map((group) => {
    if (group.collapsible) {
      const GroupIcon = group.collapsible.icon;
      const open = accountOpen;
      return (
        <div key={group.id}>
          <button
            type="button"
            onClick={() => setAccountOpenManual(!open)}
            aria-expanded={open}
            className={`${ROW} w-full ${accountActive && !open ? "text-foreground" : ROW_IDLE}`}
          >
            <GroupIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="flex-1 truncate text-left">{t(group.labelKey)}</span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
          {open && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
              {group.items.map(renderItem)}
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={group.id}>
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t(group.labelKey)}
        </p>
        <div className="space-y-0.5">{group.items.map(renderItem)}</div>
      </div>
    );
  });

  const helpLink = (
    <Link href="/support" className={`${ROW} ${ROW_IDLE}`}>
      <LifeBuoy className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <span className="flex-1 truncate">{t("help")}</span>
    </Link>
  );

  const adminLink = isAdmin ? (
    <Link
      href="/dashboard/admin"
      className={`${ROW} text-amber-700 hover:bg-amber-500/10 dark:text-amber-300`}
    >
      <Shield className="size-4 shrink-0" />
      <span className="flex-1 truncate">{t("adminPanel")}</span>
    </Link>
  ) : null;

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogoutClick}
      className={`${ROW} w-full ${
        confirmLogout
          ? "bg-red-600 text-white hover:bg-red-700"
          : "text-red-600 hover:bg-red-500/10 dark:text-red-400"
      }`}
    >
      <LogOut className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{confirmLogout ? tc("logoutConfirm") : tc("logout")}</span>
    </button>
  );

  const isLevelActive = pathname === "/dashboard/level";
  const userCard = user && (
    <Link
      href="/dashboard/level"
      className={`flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 transition-colors hover:bg-muted ${
        isLevelActive ? "ring-2 ring-primary/30" : ""
      }`}
      title={level ? `${t("myLevel")}: ${level.name}` : undefined}
    >
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
        {level ? (
          <>
            <span className={`block truncate text-xs ${level.color}`}>
              {level.icon} {level.name}
            </span>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${level.progress}%` }} />
            </span>
          </>
        ) : (
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        )}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );

  const bottomBlock = (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="space-y-0.5">
        {adminLink}
        {helpLink}
        {logoutButton}
      </div>
      {userCard}
      <p className="px-1 text-center text-[11px] text-muted-foreground/70">
        {"\u00a9"} {new Date().getFullYear()} Cards Center
      </p>
    </div>
  );

  return (
    <>
      {/* Mobiel: compacte balk + uitklapmenu */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-card"
          aria-expanded={mobileOpen}
        >
          <div className="flex items-center gap-2.5">
            <ActiveIcon className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t(activeItem.labelKey)}</span>
          </div>
          {mobileOpen ? <X className="size-5 text-muted-foreground" /> : <Menu className="size-5 text-muted-foreground" />}
        </button>
        {mobileOpen && (
          <nav className="mt-2 space-y-4 rounded-2xl border border-border bg-card p-3 shadow-card">
            {navGroups}
            {bottomBlock}
          </nav>
        )}
      </div>

      {/* Desktop: vaste sidebar-kaart, sticky onder de header */}
      {/* Desktop: de kolom-achtergrond komt van de <aside> in de layout; hier
          alleen de inhoud, sticky onder de header. */}
      <nav className="hidden md:sticky md:top-[88px] md:flex md:flex-col md:gap-5">
        {navGroups}
        {bottomBlock}
      </nav>
    </>
  );
}
