import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Gavel,
  Store,
  PlusCircle,
  Truck,
  UserCircle,
  ArrowRight,
  PartyPopper,
} from "lucide-react";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <WelcomeContent name={session.user?.name ?? ""} />;
}

function WelcomeContent({ name }: { name: string }) {
  const t = useTranslations("auth");

  const actions = [
    {
      href: "/veilingen" as const,
      icon: Gavel,
      title: t("welcomeAuctions"),
      description: t("welcomeAuctionsDesc"),
      color: "bg-blue-500",
    },
    {
      href: "/marktplaats" as const,
      icon: Store,
      title: t("welcomeMarketplace"),
      description: t("welcomeMarketplaceDesc"),
      color: "bg-emerald-500",
    },
    {
      href: "/marktplaats/nieuw" as const,
      icon: PlusCircle,
      title: t("welcomeCreateListing"),
      description: t("welcomeCreateListingDesc"),
      color: "bg-amber-500",
    },
    {
      href: "/dashboard/verzending" as const,
      icon: Truck,
      title: t("welcomeShipping"),
      description: t("welcomeShippingDesc"),
      color: "bg-purple-500",
    },
    {
      href: "/dashboard/profiel" as const,
      icon: UserCircle,
      title: t("welcomeProfile"),
      description: t("welcomeProfileDesc"),
      color: "bg-pink-500",
    },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("welcomeTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("welcomeSubtitle")}
          </p>
        </div>

        {/* Action cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ href, icon: Icon, title, description, color }) => (
            <Link
              key={href}
              href={href}
              className="group glass rounded-xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
          >
            {t("welcomeStart")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
