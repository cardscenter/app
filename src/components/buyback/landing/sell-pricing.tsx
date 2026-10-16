import { getLocale, getTranslations } from "next-intl/server";
import { Banknote, ClipboardCheck, Search, Send, XCircle } from "lucide-react";
import {
  BULK_ONLY_RARITIES,
  MAX_BUYBACK_MARKTPRIJS,
  MINIMUM_BULK_VALUE,
  checkBuybackEligibility,
  getBuybackPrice,
  type BulkGroup,
} from "@/lib/buyback-pricing";
import { getBulkPricing, bulkRowName } from "@/lib/buyback-pricing-db";
import { formatCurrency } from "@/lib/format";
import { RATE_LABEL, currencyLocale } from "./sell-hero";

// "Hoe werkt het" + prijsuitleg voor losse kaarten + bulk-prijstabel.
// De tabel rendert rechtstreeks uit BULK_PRICING zodat een tariefwijziging
// nooit op twee plekken hoeft.

const STEPS = [
  { Icon: Search, titleKey: "step1Title", descKey: "step1Desc" },
  { Icon: Send, titleKey: "step2Title", descKey: "step2Desc" },
  { Icon: ClipboardCheck, titleKey: "step3Title", descKey: "step3Desc" },
  { Icon: Banknote, titleKey: "step4Title", descKey: "step4Desc" },
] as const;

// Voorbeeld-marktprijzen: twee inkoopbare, één boven de cap.
const EXAMPLE_MARKET_PRICES = [10, 40, MAX_BUYBACK_MARKTPRIJS + 5];

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Set bevat "rare holo" én "holo rare" (matching-varianten) — één keer tonen. */
function uniqueBulkOnlyRarities(): string[] {
  const seen = new Set<string>();
  return Array.from(BULK_ONLY_RARITIES).filter((r) => {
    const key = r.split(" ").sort().join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function SellHowItWorks() {
  const t = await getTranslations("buyback");
  return (
    <section>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{t("howItWorks")}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("landing.howItWorksSubtitle")}
        </p>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, idx) => (
          <div key={step.titleKey} className="relative">
            {idx < STEPS.length - 1 && (
              <div
                aria-hidden
                className="absolute left-1/2 top-7 hidden h-px w-full bg-gradient-to-r from-border via-border to-transparent lg:block"
              />
            )}
            <div className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex size-14 items-center justify-center rounded-full border border-border bg-background shadow-card">
                <step.Icon className="size-6 text-foreground" />
                <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                  {idx + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{t(step.titleKey)}</h3>
              <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                {t(step.descKey)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export async function SellSinglesPricing() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));

  const rows = EXAMPLE_MARKET_PRICES.map((market) => {
    const { eligible } = checkBuybackEligibility(market, "2020-01-01");
    return { market, payout: eligible ? getBuybackPrice(market) : null };
  });

  const limits = [
    t("conditionPricing"),
    t("conditionMaxPrice"),
    t("conditionEra"),
    t("conditionMinCollection"),
    t("conditionNM"),
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <h2 className="text-2xl font-bold text-foreground">{t("landing.singlesExampleTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {t("landing.singlesExampleIntro", { rate: RATE_LABEL })}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t("landing.exampleColMarket")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("landing.exampleColPayout")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.market} className="bg-card">
                    <td className="px-4 py-3 font-medium text-foreground">{fmt(r.market)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.payout != null ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {fmt(r.payout)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <XCircle className="size-3.5" />
                          {t("landing.exampleNotEligible", { max: fmt(MAX_BUYBACK_MARKTPRIJS) })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("landing.bulkOnlyNote", {
              list: uniqueBulkOnlyRarities().map(capitalize).join(", "),
            })}
          </p>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("landing.singlesLimitsTitle")}
          </h3>
          <ul className="mt-3 space-y-2">
            {limits.map((l) => (
              <li key={l} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export async function SellBulkPricing() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));

  const groups: { group: BulkGroup; titleKey: "bulkSectionPokemon" | "bulkSectionOther" }[] = [
    { group: "pokemon", titleKey: "bulkSectionPokemon" },
    { group: "other", titleKey: "bulkSectionOther" },
  ];
  // Fase 6: tarieven uit de beheerbare tabel (admin-panel), niet meer uit de code.
  const rows = await getBulkPricing();

  return (
    <section className="rounded-2xl border border-amber-200/70 bg-card p-6 shadow-card dark:border-amber-800/40 sm:p-8">
      <h2 className="text-2xl font-bold text-foreground">{t("landing.bulkTableTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("landing.bulkTableIntro")}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {groups.map(({ group, titleKey }) => (
          <div key={group} className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-left text-xs uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t(titleKey)}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("bulkPricePerUnit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows
                  .filter((v) => v.group === group)
                  .map((v) => (
                    <tr key={v.key} className="bg-card">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-foreground">{bulkRowName(v, locale)}</span>
                        {v.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {v.description}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {fmt(v.price)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>{t("landing.bulkMinNote", { min: fmt(MINIMUM_BULK_VALUE) })}</p>
        <p>{t("landing.bulkCountsNote")}</p>
      </div>
    </section>
  );
}
