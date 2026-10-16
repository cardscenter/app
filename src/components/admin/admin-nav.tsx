"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_ROW, NAV_ROW_ACTIVE, NAV_ROW_IDLE, NAV_ICON_IDLE, NAV_GROUP_LABEL } from "@/components/dashboard/nav-styles";
import { CalendarCheck, Tags, Settings2, ScanLine, UtensilsCrossed, ChefHat, QrCode, Trophy, ClipboardList, Stamp, Newspaper } from "lucide-react";
import {
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Wallet,
  ArrowDownToLine,
  Flag,
  CreditCard,
  Users,
  Ban,
  Library,
  Settings,
  Activity,
  History,
  Shield,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Gamepad2,
  Truck,
  CalendarDays,
} from "lucide-react";

// Admin-sidebar in dezelfde donkere aside als de gebruikers-nav (zie
// dashboard-shell.tsx): gedeelde rij-stijlen uit nav-styles.ts. Gegroepeerd
// zoals het gebruikersdashboard (Algemeen / Verkopen / Kopen / …):
//   Overzicht · Geschillen & meldingen · Financieel · Gebruikers ·
//   Content & evenementen · Systeem

type Section = {
  label: string;
  items: { href: string; labelKey: string; icon: typeof LayoutDashboard; badge?: number }[];
};

export function AdminNav({
  pendingCounts,
}: {
  pendingCounts?: {
    disputes?: number;
    shippingIssues?: number;
    verifications?: number;
    withdrawals?: number;
    buybacks?: number;
    reports?: number;
    sellerWarnings?: number;
    enterpriseRequests?: number;
    eventApprovals?: number;
    eventReports?: number;
  };
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  const sections: Section[] = [
    {
      label: "sectionOverview",
      items: [{ href: "/dashboard/admin", labelKey: "navOverview", icon: LayoutDashboard }],
    },
    {
      label: "sectionDisputes",
      items: [
        { href: "/dashboard/admin/disputes", labelKey: "navDisputes", icon: Scale, badge: pendingCounts?.disputes },
        { href: "/dashboard/admin/shipping-issues", labelKey: "navShippingIssues", icon: Truck, badge: pendingCounts?.shippingIssues },
        { href: "/dashboard/admin/reports", labelKey: "navReports", icon: Flag, badge: pendingCounts?.reports },
        { href: "/dashboard/admin/seller-warnings", labelKey: "navSellerWarnings", icon: AlertTriangle, badge: pendingCounts?.sellerWarnings },
      ],
    },
    {
      label: "sectionFinance",
      items: [
        { href: "/dashboard/admin/withdrawals", labelKey: "navWithdrawals", icon: Wallet, badge: pendingCounts?.withdrawals },
        { href: "/dashboard/admin/bank-transfers", labelKey: "navBankTransfers", icon: CreditCard },
        { href: "/dashboard/admin/buybacks", labelKey: "navBuybacks", icon: ArrowDownToLine, badge: pendingCounts?.buybacks },
      ],
    },
    {
      label: "sectionUsers",
      items: [
        { href: "/dashboard/admin/users", labelKey: "navUsers", icon: Users },
        { href: "/dashboard/admin/verifications", labelKey: "navVerifications", icon: ShieldCheck, badge: pendingCounts?.verifications },
        { href: "/dashboard/admin/enterprise-requests", labelKey: "navEnterpriseRequests", icon: Building2, badge: pendingCounts?.enterpriseRequests },
        { href: "/dashboard/admin/games", labelKey: "navGames", icon: Gamepad2 },
      ],
    },
    {
      label: "sectionShop",
      items: [
        { href: "/dashboard/admin/events", labelKey: "navShopEvents", icon: CalendarCheck },
        { href: "/dashboard/admin/event-types", labelKey: "navEventTypes", icon: Tags },
        { href: "/dashboard/staff/check-in", labelKey: "navCheckIn", icon: ScanLine },
        { href: "/dashboard/admin/menu", labelKey: "navMenu", icon: UtensilsCrossed },
        { href: "/keuken", labelKey: "navKitchen", icon: ChefHat },
        { href: "/dashboard/admin/qr-codes", labelKey: "navQrCodes", icon: QrCode },
        { href: "/dashboard/admin/hub-settings", labelKey: "navHubSettings", icon: Settings2 },
      ],
    },
    {
      label: "sectionCommunity",
      items: [
        { href: "/dashboard/admin/league", labelKey: "navLeague", icon: Trophy },
        { href: "/dashboard/staff/league", labelKey: "navStaffLeague", icon: ClipboardList },
        { href: "/dashboard/staff/spaarkaart", labelKey: "navLoyalty", icon: Stamp },
        { href: "/dashboard/admin/news", labelKey: "navNews", icon: Newspaper },
      ],
    },
    {
      label: "sectionContent",
      items: [
        { href: "/dashboard/admin/moderation", labelKey: "navModeration", icon: Ban },
        { href: "/dashboard/admin/event-approvals", labelKey: "navEventApprovals", icon: CalendarDays, badge: pendingCounts?.eventApprovals },
        { href: "/dashboard/admin/event-reports", labelKey: "navEventReports", icon: Flag, badge: pendingCounts?.eventReports },
        { href: "/dashboard/admin/catalog", labelKey: "navCatalog", icon: Library },
      ],
    },
    {
      label: "sectionSystem",
      items: [
        { href: "/dashboard/admin/config", labelKey: "navConfig", icon: Settings },
        { href: "/dashboard/admin/crons", labelKey: "navCrons", icon: Activity },
        { href: "/dashboard/admin/audit", labelKey: "navAudit", icon: History },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/dashboard/admin") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const navLinks = sections.map((section) => (
    <div key={section.label}>
      <p className={NAV_GROUP_LABEL}>{t(section.label)}</p>
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${NAV_ROW} ${active ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}
            >
              <Icon className={`size-4 shrink-0 ${active ? "" : NAV_ICON_IDLE}`} />
              <span className="flex-1 truncate">{t(item.labelKey)}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-[11px] font-semibold text-red-300">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  ));

  const personalDashboardLink = (
    <Link
      href="/dashboard"
      className={`${NAV_ROW} w-full justify-center border border-sidebar-border bg-white/5 text-sidebar-foreground hover:bg-white/10 hover:text-white`}
    >
      <ArrowLeft className="size-4 shrink-0" />
      {t("switchToUserDashboard")}
    </Link>
  );

  const adminBadge = (
    <Link
      href="/dashboard/admin"
      className="block rounded-md border border-amber-400/30 bg-amber-400/10 p-2.5 transition-colors hover:bg-amber-400/15"
    >
      <div className="flex items-center gap-2">
        <Shield className="size-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-amber-300/80">{t("modeLabel")}</p>
          <p className="truncate text-[13px] font-bold text-amber-100">{t("panelTitle")}</p>
        </div>
      </div>
    </Link>
  );

  return (
    <nav className="flex flex-1 flex-col gap-4 px-3 py-4 md:pl-[clamp(1rem,3vw,4rem)] md:pr-3">
      {adminBadge}
      {navLinks}
      <div className="mt-auto border-t border-sidebar-border pt-3">{personalDashboardLink}</div>
    </nav>
  );
}
