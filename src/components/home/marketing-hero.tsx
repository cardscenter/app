import { useTranslations } from "next-intl";
import { HeroEmailForm } from "@/components/home/hero-email-form";
import { HeroParticles } from "@/components/home/hero-particles";
import { HeroStatBadges } from "@/components/home/hero-stat-badges";
import type { HomepageStats } from "@/lib/homepage-data";

interface MarketingHeroProps {
  stats: HomepageStats;
}

export function MarketingHero({ stats }: MarketingHeroProps) {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden min-h-[480px] flex items-center bg-slate-900">
      {/* Layered gradients for depth */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
      </div>

      {/* Floating particles */}
      <HeroParticles />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1680px] px-6 py-16 lg:py-20 lg:px-8 xl:px-10 w-full">
        <div className="max-w-2xl">
          {/* Animated stat badges */}
          <HeroStatBadges stats={stats} />

          <h1 className="text-balance text-4xl font-bold text-white md:text-5xl lg:text-6xl leading-tight">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-white/80 max-w-md">
            {t("heroSubtitle")}
          </p>

          <HeroEmailForm />

          <ul className="list-inside list-disc space-y-2 text-sm text-white/70">
            <li>{t("featureSecure")}</li>
            <li>{t("featureAntiSnipe")}</li>
            <li>{t("featureFreeAccount")}</li>
          </ul>
        </div>
      </div>

      {/* Bottom gradient fade to content */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
}
