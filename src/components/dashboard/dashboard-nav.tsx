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
  Package,
  Truck,
  Scale,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

interface NavSection {
  label: string;
  items: { href: string; labelKey: string; icon: typeof LayoutDashboard }[];
}

export function DashboardNav({ accountType }: { accountType?: string }) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const isAdmin = accountType === "ADMIN";

  const sections: NavSection[] = [
    {
      label: "Overzicht",
      items: [
        { href: "/dashboard", labelKey: "title", icon: LayoutDashboard },
      ],
    },
    {
      label: "Verkopen",
      items: [
        { href: "/dashboard/veilingen", labelKey: "myAuctions", icon: Gavel },
        { href: "/dashboard/claimsales", labelKey: "myClaimsales", icon: Tag },
        { href: "/dashboard/marktplaats", labelKey: "myListings", icon: Store },
        { href: "/dashboard/verkopen", labelKey: "mySales", icon: Package },
      ],
    },
    {
      label: "Kopen",
      items: [
        { href: "/dashboard/aankopen", labelKey: "myPurchases", icon: ShoppingBag },
        { href: "/dashboard/biedingen", labelKey: "myBids", icon: Gavel },
        { href: "/dashboard/volglijst", labelKey: "myWatchlist", icon: Heart },
      ],
    },
    {
      label: "Handel",
      items: [
        { href: "/dashboard/saldo", labelKey: "myBalance", icon: Wallet },
        { href: "/dashboard/verzending", labelKey: "myShipping", icon: Truck },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/dashboard/profiel", labelKey: "profile", icon: User },
        { href: "/dashboard/abonnement", labelKey: "mySubscription", icon: CreditCard },
        { href: "/dashboard/verificatie", labelKey: "myVerification", icon: ShieldCheck },
        { href: "/dashboard/reviews", labelKey: "myReviews", icon: Star },
        { href: "/dashboard/meldingen", labelKey: "myNotifications", icon: Bell },
      ],
    },
    {
      label: "Geschillen",
      items: [
        { href: "/dashboard/geschillen", labelKey: "myDisputes", icon: Scale },
        ...(isAdmin
          ? [{ href: "/dashboard/geschillen/admin", labelKey: "adminDisputes", icon: Scale }]
          : []),
      ],
    },
  ];

  return (
    <nav className="glass-nav flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:gap-0.5">
      {sections.map((section) => (
        <div key={section.label} className="md:mb-2">
          <p className="hidden md:block px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {section.label}
          </p>
          {section.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
        </div>
      ))}
    </nav>
  );
}
