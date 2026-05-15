import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowRight, ShieldCheck, BadgeCheck, MessageSquare } from "lucide-react";
import type { HomepageStats, PlatformStats } from "@/lib/homepage-data";

interface MarketingHeroV2Props {
  stats: HomepageStats;
  platformStats: PlatformStats;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("nl-NL").format(Math.round(n));
}

export function MarketingHeroV2({ stats, platformStats }: MarketingHeroV2Props) {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      {/* Volledige achtergrondfoto */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-banner.png"
          alt={t("heroV2ImageAlt")}
          fill
          sizes="100vw"
          className="object-cover object-[75%_center]"
          priority
        />
        {/* Dark overlay — links sterker, rechts laat de foto-subject doorschijnen */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.85) 30%, rgba(2,6,23,0.55) 60%, rgba(2,6,23,0.25) 100%)",
          }}
        />
        {/* Bottom-gradient voor extra leesbaarheid van stat-pills */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/80 to-transparent"
        />
      </div>

      {/* Content */}
      <div className="relative mx-auto w-full max-w-[1680px] px-4 py-20 sm:px-6 lg:px-8 lg:py-32 xl:px-10 xl:py-36">
        <div className="max-w-xl lg:max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
            {t("heroV2Eyebrow")}
          </p>

          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl xl:text-7xl">
            {t("heroV2Title")}
          </h1>

          <p className="mt-6 max-w-md text-base text-slate-200 sm:text-lg">
            {t("heroV2Subtitle")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-hover"
            >
              {t("heroV2CtaPrimary")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/veilingen?sort=ending"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-3 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/15"
            >
              {t("heroV2CtaSecondary")}
            </Link>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-200">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-400" />
              {t("heroV2TrustEscrow")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-4 text-sky-400" />
              {t("heroV2TrustSupport")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-violet-400" />
              {t("heroV2TrustVerified")}
            </li>
          </ul>

          {/* Mini-stat-pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            <StatPill value={formatNumber(platformStats.totalCompletedSales)} label={t("heroV2StatSales")} />
            <StatPill value={formatNumber(platformStats.totalMembers)} label={t("heroV2StatMembers")} />
            <StatPill value={formatNumber(stats.activeAuctions)} label={t("heroV2StatActiveAuctions")} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/20 backdrop-blur">
      <span className="font-semibold text-white">{value}</span>
      <span className="text-slate-300">{label}</span>
    </span>
  );
}
