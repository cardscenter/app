"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Gavel,
  Tag,
  ShoppingBag,
  Store,
  Heart,
  Bell,
  Wallet,
  User,
  Star,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
  { href: "/dashboard/veilingen", labelKey: "myAuctions", icon: Gavel },
  { href: "/dashboard/claimsales", labelKey: "myClaimsales", icon: Tag },
  { href: "/dashboard/marktplaats", labelKey: "myListings", icon: Store },
  { href: "/dashboard/biedingen", labelKey: "myBids", icon: Gavel },
  { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag },
  { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart },
  { href: "/dashboard/meldingen", labelKey: "myNotifications", icon: Bell },
  { href: "/dashboard/reviews", labelKey: "myReviews", icon: Star },
  { href: "/dashboard/saldo", labelKey: "myBalance", icon: Wallet },
  { href: "/dashboard/profiel", labelKey: "profile", icon: User },
] as const;

export function DashboardNav() {
  const t = useTranslations("dashboard");
  const pathname = usePathname();

  return (
    <nav className="glass-nav flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:gap-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
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
    </nav>
  );
}
