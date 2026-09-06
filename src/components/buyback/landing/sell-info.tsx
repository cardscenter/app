import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileText,
  Layers,
  Mail,
  MapPin,
  Package,
  Truck,
  Wallet,
} from "lucide-react";
import { getStoreCreditBonus } from "@/lib/buyback-pricing";
import { formatCurrency } from "@/lib/format";
import { PLATFORM } from "@/lib/platform-config";
import { BONUS_LABEL, currencyLocale } from "./sell-hero";

// Voorwaarden-checklist, verzenden & verpakken, uitbetaling en afsluitende CTA.

export async function SellConditions() {
  const t = await getTranslations("buyback");
  const conditions = [
    t("conditionNM"),
    t("conditionCentering"),
    t("conditionEnglish"),
    t("conditionOriginal"),
    t("conditionPricing"),
    t("conditionMaxPrice"),
    t("conditionEra"),
    t("conditionMinCollection"),
    t("conditionMinBulk"),
    t("conditionPayout"),
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <h2 className="text-2xl font-bold text-foreground">{t("conditions")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("landing.conditionsSubtitle")}</p>
      <ul className="mt-6 grid gap-2.5 md:grid-cols-2">
        {conditions.map((c) => (
          <li key={c} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/verkopen/voorwaarden-losse-kaarten"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <FileText className="size-4" />
          {t("landing.termsSinglesLink")}
        </Link>
        <Link
          href="/verkopen/voorwaarden-bulk"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <FileText className="size-4" />
          {t("landing.termsBulkLink")}
        </Link>
      </div>
    </section>
  );
}

export async function SellShipping() {
  const t = await getTranslations("buyback");
  const bullets = [
    t("landing.shippingBullet1"),
    t("landing.shippingBullet2"),
    t("landing.shippingBullet3"),
    t("landing.shippingBullet4"),
    t("landing.shippingBullet5"),
  ];
  const a = PLATFORM.address;
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Truck className="size-5" />
        </span>
        <h2 className="text-2xl font-bold text-foreground">{t("landing.shippingTitle")}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("landing.shippingIntro")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <ol className="space-y-3 lg:col-span-3">
          {bullets.map((b, i) => (
            <li key={b} className="flex items-start gap-3 text-sm text-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">{b}</span>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="size-3.5" />
            {t("landing.shippingAddressLabel")}
          </div>
          <address className="mt-2 not-italic text-sm leading-relaxed text-foreground">
            <p className="font-semibold">{PLATFORM.legalName}</p>
            <p>
              {a.street} {a.houseNumber}
            </p>
            <p>
              {a.postalCode} {a.city}
            </p>
            <p>{a.country}</p>
          </address>
          <p className="mt-3 text-xs text-muted-foreground">{t("landing.shippingCostNote")}</p>
          <Link
            href="/verkopen/verpakken"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t("landing.shippingFullGuide")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export async function SellPayout() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));
  const base = 100;
  const total = base + getStoreCreditBonus(base);

  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Wallet className="size-5" />
        </span>
        <h2 className="text-2xl font-bold text-foreground">{t("landing.payoutTitle")}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("landing.payoutIntro")}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Banknote className="size-5 text-foreground" />
            <h3 className="text-base font-semibold text-foreground">{t("landing.payoutBankTitle")}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("landing.payoutBankDesc")}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-card dark:border-emerald-800/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="size-5 text-emerald-700 dark:text-emerald-300" />
              <h3 className="text-base font-semibold text-foreground">{t("landing.payoutCreditTitle")}</h3>
            </div>
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
              +{BONUS_LABEL}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("landing.payoutCreditDesc")}</p>
          <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {t("landing.payoutCreditExample", { base: fmt(base), total: fmt(total) })}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("landing.payoutTiming")}</p>
    </section>
  );
}

export async function SellCtaBand() {
  const t = await getTranslations("buyback");
  return (
    <section className="rounded-3xl bg-slate-950 px-6 py-10 text-center text-white shadow-card sm:px-10">
      <h2 className="text-2xl font-bold sm:text-3xl">{t("landing.ctaBandTitle")}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{t("landing.ctaBandDesc")}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/verkopen/losse-kaarten"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100 sm:w-auto"
        >
          <Layers className="size-4" />
          {t("landing.ctaSingles")}
        </Link>
        <Link
          href="/verkopen/bulk"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 sm:w-auto"
        >
          <Package className="size-4" />
          {t("landing.ctaBulk")}
        </Link>
      </div>
      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-400">
        <Mail className="size-3.5" />
        {t.rich("landing.questions", {
          email: () => (
            <a href={`mailto:${PLATFORM.supportEmail}`} className="font-medium text-slate-200 hover:underline">
              {PLATFORM.supportEmail}
            </a>
          ),
        })}
      </p>
    </section>
  );
}
