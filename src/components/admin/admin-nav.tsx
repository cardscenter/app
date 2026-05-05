"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
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
  Menu,
  X,
  Shield,
  ArrowLeft,
  AlertTriangle,
  Building2,
} from "lucide-react";

type Section = {
  label: string;
  items: { href: string; labelKey: string; icon: typeof LayoutDashboard; badge?: number }[];
};

export function AdminNav({
  pendingCounts,
}: {
  pendingCounts?: {
    disputes?: number;
    verifications?: number;
    withdrawals?: number;
    buybacks?: number;
    reports?: number;
    sellerWarnings?: number;
    enterpriseRequests?: number;
  };
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: Section[] = [
    {
      label: "sectionOverview",
      items: [
        { href: "/dashboard/admin", labelKey: "navOverview", icon: LayoutDashboard },
      ],
    },
    {
      label: "sectionQueues",
      items: [
        { href: "/dashboard/admin/disputes", labelKey: "navDisputes", icon: Scale, badge: pendingCounts?.disputes },
        { href: "/dashboard/admin/verifications", labelKey: "navVerifications", icon: ShieldCheck, badge: pendingCounts?.verifications },
        { href: "/dashboard/admin/withdrawals", labelKey: "navWithdrawals", icon: Wallet, badge: pendingCounts?.withdrawals },
        { href: "/dashboard/admin/buybacks", labelKey: "navBuybacks", icon: ArrowDownToLine, badge: pendingCounts?.buybacks },
        { href: "/dashboard/admin/reports", labelKey: "navReports", icon: Flag, badge: pendingCounts?.reports },
        { href: "/dashboard/admin/seller-warnings", labelKey: "navSellerWarnings", icon: AlertTriangle, badge: pendingCounts?.sellerWarnings },
        { href: "/dashboard/admin/enterprise-requests", labelKey: "navEnterpriseRequests", icon: Building2, badge: pendingCounts?.enterpriseRequests },
        { href: "/dashboard/admin/bank-transfers", labelKey: "navBankTransfers", icon: CreditCard },
      ],
    },
    {
      label: "sectionUsersContent",
      items: [
        { href: "/dashboard/admin/users", labelKey: "navUsers", icon: Users },
        { href: "/dashboard/admin/moderation", labelKey: "navModeration", icon: Ban },
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

  const allItems = sections.flatMap((s) => s.items);
  const activeItem = allItems.find((i) => isActive(i.href)) ?? allItems[0];
  const ActiveIcon = activeItem.icon;

  const navLinks = sections.map((section) => (
    <div key={section.label}>
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t(section.label)}
      </p>
      {section.items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </span>
            {item.badge != null && item.badge > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500/15 px-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  ));

  const personalDashboardLink = (
    <Link
      href="/dashboard"
      onClick={() => setMobileOpen(false)}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {t("switchToUserDashboard")}
    </Link>
  );

  const adminBadge = (
    <Link
      href="/dashboard/admin"
      className="block rounded-xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-amber-100 p-3 dark:border-amber-700/40 dark:from-amber-950/40 dark:to-amber-900/30"
    >
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-700/80 dark:text-amber-300/80">{t("modeLabel")}</p>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 truncate">{t("panelTitle")}</p>
        </div>
      </div>
    </Link>
  );

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
          {mobileOpen ? <X className="h-5 w-5 text-muted-foreground" /> : <Menu className="h-5 w-5 text-muted-foreground" />}
        </button>

        {mobileOpen && (
          <>
            <div className="glass-nav mt-2 rounded-xl p-2 space-y-1">
              <div className="mb-2">{adminBadge}</div>
              {navLinks}
            </div>
            <div className="mt-3">{personalDashboardLink}</div>
          </>
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <nav className="glass-nav rounded-xl p-2 space-y-0.5">
          <div className="mb-2">{adminBadge}</div>
          {navLinks}
        </nav>
        <div className="mt-3">{personalDashboardLink}</div>
      </div>
    </>
  );
}
