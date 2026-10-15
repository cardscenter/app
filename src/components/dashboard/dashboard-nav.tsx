"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { signOut } from "next-auth/react";
import { AdminNav } from "@/components/admin/admin-nav";
import type { AdminQueueCounts } from "@/lib/admin-queue-counts";
import { useRealtime } from "@/components/providers/realtime-provider";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import type { FeatureFlag } from "@/lib/feature-flags";
import { NAV_ROW, NAV_ROW_ACTIVE, NAV_ROW_IDLE, NAV_ICON_IDLE, NAV_GROUP_LABEL } from "./nav-styles";
import { Ticket, ScanLine, UtensilsCrossed, ChefHat } from "lucide-react";
import {
  LayoutDashboard,
  BarChart3,
  ShoppingBag,
  Store,
  LayoutTemplate,
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
  ArrowDownToLine,
  LogOut,
  Shield,
  HandCoins,
  LifeBuoy,
  MessageSquare,
  Bell,
  ChevronDown,
} from "lucide-react";

// Sidebar in TailAdmin-stijl (sept 2026): donkere navy kolom (in beide
// thema's), compacte rijen (~32px), platte groepen met uppercase-labels,
// Account als uitklaprij, en een Support-groep met Berichten/Meldingen
// (ongelezen-badges, live via SSE) + Help. Onderaan een compacte
// gebruikerskaart met level-voortgang en een uitlog-icoon (2-staps confirm).
// Positionering (sticky kolom / off-canvas drawer) zit in dashboard-shell.tsx;
// dit component rendert alleen de inhoud. AdminNav-swap voor /dashboard/admin/*.

type NavItem = {
  href: string;
  labelKey: string;
  /** Vertaal-namespace voor labelKey (default "dashboard"). */
  ns?: "dashboard" | "common";
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
  /** Toon een pulserend rood "Live"-bolletje i.p.v. het icoon (Live Hub). */
  liveIndicator?: boolean;
  /** Count-badge naast de label. Hidden bij 0 of undefined. */
  badge?: number;
  /** neutral = informatief (aanbod-count), attention = vraagt actie (ongelezen). */
  badgeTone?: "neutral" | "attention";
  /** Extra route-prefixes waarop dit item ook actief is (cluster-tabs). */
  match?: string[];
  /** Alleen tonen zolang deze feature-flag zichtbaar is (Community Hub, Fase 1). */
  flag?: FeatureFlag;
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

type UnreadCounts = { messages: number; notifications: number };

type DashboardNavProps = {
  accountType?: string;
  /** Rol (PLAYER | STAFF | ADMIN) voor de staff-groep (Community Hub). */
  role?: string;
  level?: LevelInfo;
  /** Voor de gebruikerskaart onderaan. */
  user?: { name: string; handle?: string; email: string | null; image: string | null };
  /** Badges van de admin-sidebar (zelfde bron als de KPI-tegels op /dashboard/admin). */
  adminPendingCounts?: Partial<AdminQueueCounts>;
  /** Live counts voor het Aanbod-item — auctions = ACTIVE+SCHEDULED,
   *  claimsales = LIVE+SCHEDULED, listings = ACTIVE, events = niet-DELETED. */
  counts?: { auctions: number; listings: number; claimsales: number; events?: number };
  /** Ongelezen berichten (conversaties) + meldingen, SSR-initieel; SSE houdt ze vers. */
  unread?: UnreadCounts;
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

const NO_UNREAD: UnreadCounts = { messages: 0, notifications: 0 };

function DashboardNavInner({ accountType, role, level, user, counts, unread }: DashboardNavProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // Ongelezen-tellers: SSR-waarde als start, sync bij nieuwe prop (na
  // router.refresh), en live-override via de SSE-payloads die de teller al
  // meesturen (zelfde bron als header-bel en message-icon).
  const [unreadState, setUnreadState] = useState<UnreadCounts>(unread ?? NO_UNREAD);
  const [unreadProp, setUnreadProp] = useState(unread);
  if (unreadProp !== unread) {
    setUnreadProp(unread);
    setUnreadState(unread ?? NO_UNREAD);
  }
  const { subscribe } = useRealtime();
  useEffect(() => {
    const offMessage = subscribe("new-message", (event) => {
      if (event.type !== "new-message") return;
      const messages = event.payload.unreadConversationCount;
      setUnreadState((s) => ({ ...s, messages }));
    });
    const offNotification = subscribe("notification-created", (event) => {
      if (event.type !== "notification-created") return;
      const notifications = event.payload.unreadCount;
      setUnreadState((s) => ({ ...s, notifications }));
    });
    const offRead = subscribe("unread-changed", (event) => {
      if (event.type !== "unread-changed") return;
      const messages = event.payload.unreadConversationCount;
      setUnreadState((s) => ({ ...s, messages }));
    });
    return () => {
      offMessage();
      offNotification();
      offRead();
    };
  }, [subscribe]);

  const isAdmin = accountType === "ADMIN";
  const isStaffUser = isAdmin || role === "STAFF";
  const features = useFeatureFlags();

  function handleLogoutClick() {
    if (confirmLogout) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      signOut({ callbackUrl: "/" });
      return;
    }
    setConfirmLogout(true);
    confirmTimerRef.current = setTimeout(() => setConfirmLogout(false), 4000);
  }

  // Aanbod-cluster: alleen de zichtbare handelssoorten tellen mee; de link
  // wijst naar de eerste zichtbare. Alles verborgen = geen Aanbod-item.
  const offerBadge =
    (features.FEATURE_AUCTIONS ? counts?.auctions ?? 0 : 0) +
    (features.FEATURE_CLAIMSALES ? counts?.claimsales ?? 0 : 0) +
    (features.FEATURE_MARKETPLACE ? counts?.listings ?? 0 : 0) +
    (features.FEATURE_COMMUNITY_EVENTS ? counts?.events ?? 0 : 0);
  const offerHref = features.FEATURE_AUCTIONS
    ? "/dashboard/veilingen"
    : features.FEATURE_CLAIMSALES
      ? "/dashboard/claimsales"
      : features.FEATURE_MARKETPLACE
        ? "/dashboard/marktplaats"
        : null;

  const groups: NavGroup[] = useMemo(
    () => {
      const all: NavGroup[] = [
      {
        id: "general",
        labelKey: "sectionGeneral",
        items: [
          { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
          { href: "/dashboard/tickets", labelKey: "myTickets", icon: Ticket },
          { href: "/dashboard/bestellingen", labelKey: "myFoodOrders", icon: UtensilsCrossed },
          { href: "/dashboard/statistieken", labelKey: "myStatistics", icon: BarChart3, flag: "FEATURE_WALLET" },
          {
            href: "/dashboard/saldo",
            labelKey: "navFinance",
            icon: Wallet,
            match: ["/dashboard/uitbetalingen"],
            flag: "FEATURE_WALLET",
          },
        ],
      },
      {
        id: "selling",
        labelKey: "sectionSales",
        items: [
          ...(offerHref
            ? [
                {
                  href: offerHref,
                  labelKey: "navOffer",
                  icon: Store,
                  badge: offerBadge,
                  badgeTone: "neutral" as const,
                  match: [
                    "/dashboard/veilingen",
                    "/dashboard/claimsales",
                    "/dashboard/marktplaats",
                    "/dashboard/beurzen",
                  ],
                },
              ]
            : []),
          { href: "/dashboard/verkopen", labelKey: "mySales", icon: Package, flag: "FEATURE_WALLET" },
          { href: "/dashboard/winkel", labelKey: "myShop", icon: LayoutTemplate, flag: "FEATURE_WALLET" },
          { href: "/dashboard/inkoop", labelKey: "myBuyback", icon: ArrowDownToLine },
        ],
      },
      {
        id: "buying",
        labelKey: "sectionBuying",
        items: [
          { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag, flag: "FEATURE_WALLET" },
          { href: "/dashboard/biedingen", labelKey: "myBids", icon: HandCoins, liveIndicator: true, flag: "FEATURE_AUCTIONS" },
          { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart, flag: "FEATURE_AUCTIONS" },
          { href: "/dashboard/geschillen", labelKey: "myDisputes", icon: Scale, flag: "FEATURE_WALLET" },
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
          { href: "/dashboard/verzending", labelKey: "myShipping", icon: Truck, flag: "FEATURE_WALLET" },
          { href: "/dashboard/verificatie", labelKey: "myVerification", icon: ShieldCheck },
          { href: "/dashboard/abonnement", labelKey: "mySubscription", icon: CreditCard, flag: "FEATURE_WALLET" },
          { href: "/dashboard/reviews", labelKey: "myReputation", icon: Star, match: ["/dashboard/level"], flag: "FEATURE_WALLET" },
        ],
      },
      ...(isStaffUser
        ? [
            {
              id: "staff",
              labelKey: "sectionStaff",
              items: [
                { href: "/dashboard/staff/check-in", labelKey: "staffCheckIn", icon: ScanLine },
                { href: "/keuken", labelKey: "staffKitchen", icon: ChefHat },
              ],
            } as NavGroup,
          ]
        : []),
      {
        id: "support",
        labelKey: "sectionSupport",
        items: [
          {
            href: "/berichten",
            labelKey: "messages",
            ns: "common",
            icon: MessageSquare,
            badge: unreadState.messages,
            badgeTone: "attention",
          },
          {
            href: "/dashboard/meldingen",
            labelKey: "myNotifications",
            icon: Bell,
            badge: unreadState.notifications,
            badgeTone: "attention",
          },
          { href: "/support", labelKey: "help", icon: LifeBuoy },
        ],
      },
      ];
      // Items achter een uitgeschakelde flag weg; lege groepen ook.
      return all
        .map((g) => ({ ...g, items: g.items.filter((i) => !i.flag || features[i.flag]) }))
        .filter((g) => g.items.length > 0);
    },
    [offerBadge, offerHref, features, unreadState.messages, unreadState.notifications, isStaffUser],
  );

  function isPathActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }
  function isActive(item: NavItem) {
    if (isPathActive(item.href)) return true;
    return item.match?.some((m) => isPathActive(m)) ?? false;
  }
  function label(item: NavItem) {
    return item.ns === "common" ? tc(item.labelKey) : t(item.labelKey);
  }

  // Account-uitklaprij: open zolang een kind actief is, anders handmatig.
  const accountActive = groups.find((g) => g.id === "account")?.items.some((i) => isActive(i)) ?? false;
  const [accountOpenManual, setAccountOpenManual] = useState<boolean | null>(null);
  const accountOpen = accountOpenManual ?? accountActive;

  function renderItem(item: NavItem, compact = false) {
    const Icon = item.icon;
    const rowSize = compact ? "py-1" : "";
    if (item.comingSoon) {
      return (
        <div
          key={item.href}
          className={`${NAV_ROW} ${rowSize} cursor-not-allowed text-sidebar-foreground/40`}
          aria-disabled="true"
          title="Binnenkort beschikbaar"
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{label(item)}</span>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
            Soon
          </span>
        </div>
      );
    }
    const active = isActive(item);
    const showBadge = typeof item.badge === "number" && item.badge > 0;
    const badgeClass = active
      ? "bg-white/15 text-white"
      : item.badgeTone === "attention"
        ? "bg-sidebar-primary text-white"
        : "bg-white/10 text-sidebar-foreground";
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`${NAV_ROW} ${rowSize} ${active ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}
      >
        {item.liveIndicator ? (
          <span className="relative inline-flex size-4 shrink-0 items-center justify-center" aria-label="Live">
            <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-rose-500 opacity-75" aria-hidden />
            <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
          </span>
        ) : (
          <Icon className={`size-4 shrink-0 ${active ? "" : NAV_ICON_IDLE}`} />
        )}
        <span className="flex-1 truncate">{label(item)}</span>
        {showBadge && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${badgeClass}`}
          >
            {item.badge! > 99 ? "99+" : item.badge}
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
            className={`${NAV_ROW} w-full ${accountActive && !open ? "text-white" : NAV_ROW_IDLE}`}
          >
            <GroupIcon className={`size-4 shrink-0 ${NAV_ICON_IDLE}`} />
            <span className="flex-1 truncate text-left">{t(group.labelKey)}</span>
            <ChevronDown
              className={`size-4 shrink-0 text-sidebar-foreground/50 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
          {open && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
              {group.items.map((item) => renderItem(item, true))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={group.id}>
        <p className={NAV_GROUP_LABEL}>{t(group.labelKey)}</p>
        <div className="space-y-0.5">{group.items.map((item) => renderItem(item))}</div>
      </div>
    );
  });

  const adminLink = isAdmin ? (
    <Link href="/dashboard/admin" className={`${NAV_ROW} text-amber-300 hover:bg-amber-400/10 hover:text-amber-200`}>
      <Shield className="size-4 shrink-0" />
      <span className="flex-1 truncate">{t("adminPanel")}</span>
    </Link>
  ) : null;

  const isLevelActive = pathname === "/dashboard/level";
  // Tijdens de uitlog-bevestiging verandert de héle kaart in één rode
  // "Weet je het zeker?"-knop; na 4s zonder klik keert de kaart vanzelf terug.
  const userCard = user && confirmLogout ? (
    <button
      type="button"
      onClick={handleLogoutClick}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
    >
      <LogOut className="size-4 shrink-0" />
      <span className="truncate">{tc("logoutConfirm")}</span>
    </button>
  ) : user && (
    <div
      className={`flex items-center gap-1 rounded-md border border-sidebar-border bg-white/5 p-1.5 ${
        isLevelActive ? "ring-1 ring-sidebar-primary/60" : ""
      }`}
    >
      <Link
        href={level ? "/dashboard/level" : "/dashboard/profiel"}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5"
        title={level ? `${t("myLevel")}: ${level.name}` : undefined}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-8 shrink-0 rounded-[22%] object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[22%] bg-sidebar-primary text-xs font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-5 text-white">{user.name}</span>
          {level ? (
            <span className="mt-1 flex items-center gap-1.5">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-sidebar-primary" style={{ width: `${level.progress}%` }} />
              </span>
              <span className="shrink-0 text-[10px] leading-none tabular-nums text-sidebar-foreground/60">
                {level.icon} {Math.round(level.progress)}%
              </span>
            </span>
          ) : (
            <span className="block truncate text-[11px] text-sidebar-foreground/60">{user.email}</span>
          )}
        </span>
      </Link>
      <button
        type="button"
        onClick={handleLogoutClick}
        aria-label={tc("logout")}
        title={tc("logout")}
        className="grid size-8 shrink-0 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-red-300"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <nav className="flex flex-1 flex-col gap-4 px-3 py-4 md:pl-[clamp(1rem,3vw,4rem)] md:pr-3">
      {navGroups}
      <div className="mt-auto space-y-2 border-t border-sidebar-border pt-3">
        {adminLink}
        {userCard}
      </div>
    </nav>
  );
}
