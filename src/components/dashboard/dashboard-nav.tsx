"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Gavel,
  Tag,
  ShoppingBag,
  Store,
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
} from "lucide-react";

interface NavSection {
  label: string;
  items: { href: string; labelKey: string; icon: typeof LayoutDashboard }[];
}

interface LevelInfo {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress: number;
  nextLevelName: string | null;
}

export function DashboardNav({ accountType, level }: { accountType?: string; level?: LevelInfo }) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const isAdmin = accountType === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: NavSection[] = [
    {
      label: "sectionOverview",
      items: [
        { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
        { href: "/dashboard/statistieken", labelKey: "myStatistics", icon: BarChart3 },
      ],
    },
    {
      label: "sectionSales",
      items: [
        { href: "/dashboard/veilingen", labelKey: "myAuctions", icon: Gavel },
        { href: "/dashboard/claimsales", labelKey: "myClaimsales", icon: Tag },
        { href: "/dashboard/marktplaats", labelKey: "myListings", icon: Store },
        { href: "/dashboard/verkopen", labelKey: "mySales", icon: Package },
      ],
    },
    {
      label: "sectionBuying",
      items: [
        { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag },
        { href: "/dashboard/biedingen", labelKey: "myBids", icon: Gavel },
        { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart },
      ],
    },
    {
      label: "sectionTrading",
      items: [
        { href: "/dashboard/saldo", labelKey: "myBalance", icon: Wallet },
        { href: "/dashboard/verzending", labelKey: "myShipping", icon: Truck },
        { href: "/dashboard/inkoop", labelKey: "myBuyback", icon: ArrowDownToLine },
      ],
    },
    {
      label: "sectionAccount",
      items: [
        { href: "/dashboard/profiel", labelKey: "profile", icon: User },
        { href: "/dashboard/abonnement", labelKey: "mySubscription", icon: CreditCard },
        { href: "/dashboard/verificatie", labelKey: "myVerification", icon: ShieldCheck },
        { href: "/dashboard/reviews", labelKey: "myReviews", icon: Star },
        { href: "/dashboard/meldingen", labelKey: "myNotifications", icon: Bell },
      ],
    },
    {
      label: "sectionPersonalization",
      items: [
        { href: "/customization", labelKey: "personalization", icon: Paintbrush },
      ],
    },
    {
      label: "sectionDisputes",
      items: [
        { href: "/dashboard/geschillen", labelKey: "myDisputes", icon: Scale },
        ...(isAdmin
          ? [
              { href: "/dashboard/geschillen/admin", labelKey: "adminDisputes", icon: Scale },
              { href: "/dashboard/inkoop/admin", labelKey: "adminBuyback", icon: ArrowDownToLine },
            ]
          : []),
      ],
    },
  ];

  const isLevelActive = pathname === "/dashboard/level";

  // Find current active item for mobile header
  const allItems = sections.flatMap((s) => s.items);
  const activeItem = allItems.find(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
  ) ?? allItems[0];
  const ActiveIcon = activeItem.icon;

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

  const navLinks = sections.map((section) => (
    <div key={section.label}>
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t(section.label)}
      </p>
      {section.items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </div>
  ));

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
          <div className="glass-nav mt-2 rounded-xl p-2 space-y-1">
            {levelCard && <div className="mb-2">{levelCard}</div>}
            {navLinks}
          </div>
        )}
      </div>

      {/* Desktop: full sidebar */}
      <nav className="hidden md:block glass-nav rounded-xl p-2 space-y-0.5">
        {levelCard && <div className="mb-2">{levelCard}</div>}
        {navLinks}
      </nav>
    </>
  );
}
