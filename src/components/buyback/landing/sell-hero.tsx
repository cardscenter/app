import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Sparkles,
} from "lucide-react";
import {
  BUYBACK_ERA_START,
  BUYBACK_RATE,
  MAX_BUYBACK_MARKTPRIJS,
  MINIMUM_BULK_VALUE,
  MINIMUM_COLLECTION_VALUE,
  STORE_CREDIT_BONUS,
} from "@/lib/buyback-pricing";
import { formatCurrency } from "@/lib/format";

// Hero + keuzekaarten van /verkopen (verkopen AAN Cards Center). Alle
// bedragen/percentages komen uit buyback-pricing — nooit hardcoded in copy.

export const RATE_LABEL = `${Math.round(BUYBACK_RATE * 100)}%`;
export const BONUS_LABEL = `${Math.round(STORE_CREDIT_BONUS * 100)}%`;

export function currencyLocale(locale: string): string {
  return locale === "en" ? "en-GB" : "nl-NL";
}

export async function SellHero() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));

  const stats = [
    { Icon: Sparkles, label: t("landing.statRate", { rate: RATE_LABEL }) },
    { Icon: Clock, label: t("landing.statPayout") },
    { Icon: Banknote, label: t("landing.statCredit", { bonus: BONUS_LABEL }) },
  ];

  const singlesBullets = [
    t("landing.singlesBullet1", { rate: RATE_LABEL }),
    t("landing.singlesBullet2", { min: fmt(MINIMUM_COLLECTION_VALUE) }),
    t("landing.singlesBullet3", { max: fmt(MAX_BUYBACK_MARKTPRIJS) }),
    t("landing.singlesBullet4", { year: BUYBACK_ERA_START.slice(0, 4) }),
    t("landing.singlesBullet5"),
  ];
  const bulkBullets = [
    t("landing.bulkBullet1"),
    t("landing.bulkBullet2", { min: fmt(MINIMUM_BULK_VALUE) }),
    t("landing.bulkBullet3"),
    t("landing.bulkBullet4"),
  ];

  return (
    <>
      {/* Hero */}
      <section className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Banknote className="size-3" />
          {t("landing.eyebrow")}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t("landing.heroSubtitle", { rate: RATE_LABEL })}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/verkopen/losse-kaarten"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Layers className="size-4" />
            {t("landing.ctaSingles")}
          </Link>
          <Link
            href="/verkopen/bulk"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-amber-700 sm:w-auto"
          >
            <Package className="size-4" />
            {t("landing.ctaBulk")}
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {stats.map(({ Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-card"
            >
              <Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-muted-foreground">
          {t.rich("landing.marketplaceHint", {
            link: (chunks) => (
              <Link
                href="/marktplaats/nieuw"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>

      {/* Keuzekaarten */}
      <section>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{t("landing.pathsTitle")}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("landing.pathsSubtitle")}
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <PathCard
            href="/verkopen/losse-kaarten"
            tone="primary"
            Icon={Layers}
            title={t("landing.singlesCardTitle")}
            desc={t("landing.singlesCardDesc")}
            bullets={singlesBullets}
            cta={t("landing.ctaSingles")}
          />
          <PathCard
            href="/verkopen/bulk"
            tone="amber"
            Icon={Package}
            title={t("landing.bulkCardTitle")}
            desc={t("landing.bulkCardDesc")}
            bullets={bulkBullets}
            cta={t("landing.ctaBulk")}
          />
        </div>
      </section>
    </>
  );
}

const TONES = {
  primary: {
    ring: "hover:ring-primary/40",
    iconBg: "bg-primary/10 text-primary",
    cta: "text-primary",
    check: "text-primary",
  },
  amber: {
    ring: "hover:ring-amber-500/40",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    cta: "text-amber-600 dark:text-amber-400",
    check: "text-amber-600 dark:text-amber-400",
  },
} as const;

function PathCard({
  href,
  tone,
  Icon,
  title,
  desc,
  bullets,
  cta,
}: {
  href: "/verkopen/losse-kaarten" | "/verkopen/bulk";
  tone: keyof typeof TONES;
  Icon: typeof Layers;
  title: string;
  desc: string;
  bullets: string[];
  cta: string;
}) {
  const s = TONES[tone];
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border border-border bg-card p-7 shadow-card transition-all hover:shadow-card-hover hover:ring-2 ${s.ring}`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${s.iconBg}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${s.check}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <span className={`mt-6 flex items-center gap-2 text-sm font-semibold ${s.cta}`}>
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
