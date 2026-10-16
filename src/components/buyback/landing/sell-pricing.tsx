import { getLocale, getTranslations } from "next-intl/server";
import { XCircle } from "lucide-react";
import { BULK_ONLY_RARITIES, MAX_BUYBACK_MARKTPRIJS, MINIMUM_BULK_VALUE, checkBuybackEligibility, getBuybackPrice, type BulkGroup } from "@/lib/buyback-pricing";
import { getBulkPricing, bulkRowName } from "@/lib/buyback-pricing-db";
import { formatCurrency } from "@/lib/format";
import { PhaseLadder } from "@/components/ploy/phase-ladder";
import { DataCard } from "@/components/ploy/data-card";
import { SectionHead } from "@/components/ploy/section-head";
import { RATE_LABEL, currencyLocale } from "./sell-hero";

// "Hoe werkt het" als stappenladder + rekenvoorbeeld en bulk-tarieven als
// datakaarten. De tabel rendert rechtstreeks uit de beheerbare tarieven
// zodat een tariefwijziging nooit op twee plekken hoeft.

const STEPS = ["step1", "step2", "step3", "step4"] as const;

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
  return <PhaseLadder id="hoe" color="blue" title={t("howItWorks")} intro={t("landing.howItWorksSubtitle")} steps={STEPS.map((s) => ({ title: t(`${s}Title`), text: t(`${s}Desc`) }))} />;
}

const TH = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/45";
const TD = "px-4 py-3";

/** Rekenvoorbeeld losse kaarten + bulk-tarieven naast elkaar in datakaarten. */
export async function SellPricingCards() {
  const t = await getTranslations("buyback");
  const locale = await getLocale();
  const fmt = (n: number) => formatCurrency(n, currencyLocale(locale));

  const rows = EXAMPLE_MARKET_PRICES.map((market) => {
    const { eligible } = checkBuybackEligibility(market, "2020-01-01");
    return { market, payout: eligible ? getBuybackPrice(market) : null };
  });
  const limits = [t("conditionPricing"), t("conditionMaxPrice"), t("conditionEra"), t("conditionMinCollection"), t("conditionNM")];

  const groups: { group: BulkGroup; titleKey: "bulkSectionPokemon" | "bulkSectionOther" }[] = [
    { group: "pokemon", titleKey: "bulkSectionPokemon" },
    { group: "other", titleKey: "bulkSectionOther" },
  ];
  // Fase 6: tarieven uit de beheerbare tabel (admin-panel), niet meer uit de code.
  const pricing = await getBulkPricing();

  return (
    <section className="flex justify-center px-4 py-12 sm:px-5 lg:px-6 lg:py-16" id="tarieven">
      <div className="w-full max-w-6xl">
        <SectionHead eyebrow={t("landing.pricingEyebrow")} eyebrowColor="yellow" title={t("landing.pricingTitle")} intro={t("landing.pricingIntro", { rate: RATE_LABEL })} />
        <div className="grid gap-4 lg:grid-cols-2">
          <DataCard badge={t("landing.singlesCardTitle")} badgeColor="pink" title={t("landing.singlesExampleTitle")}>
            <p className="cc-prose text-sm">{t("landing.singlesExampleIntro", { rate: RATE_LABEL })}</p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr>
                  <th className={TH}>{t("landing.exampleColMarket")}</th>
                  <th className={`${TH} text-right`}>{t("landing.exampleColPayout")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {rows.map((r) => (
                  <tr key={r.market}>
                    <td className={`${TD} font-semibold text-[var(--foreground)]`}>{fmt(r.market)}</td>
                    <td className={`${TD} text-right`}>
                      {r.payout != null ? (
                        <span className="font-bold text-[var(--pastel-green-ink)]">{fmt(r.payout)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[var(--foreground)]/55">
                          <XCircle className="size-3.5" />
                          {t("landing.exampleNotEligible", { max: fmt(MAX_BUYBACK_MARKTPRIJS) })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--foreground)]/55">{t("landing.bulkOnlyNote", { list: uniqueBulkOnlyRarities().map(capitalize).join(", ") })}</p>
            <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]/45">{t("landing.singlesLimitsTitle")}</h3>
            <ul className="mt-2 space-y-1.5">
              {limits.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-[var(--foreground)]/80">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </DataCard>

          <DataCard badge={t("landing.bulkCardTitle")} badgeColor="yellow" title={t("landing.bulkTableTitle")}>
            <p className="cc-prose text-sm">{t("landing.bulkTableIntro")}</p>
            <div className="mt-4 space-y-5">
              {groups.map(({ group, titleKey }) => (
                <table key={group} className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH}>{t(titleKey)}</th>
                      <th className={`${TH} text-right`}>{t("bulkPricePerUnit")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {pricing
                      .filter((v) => v.group === group)
                      .map((v) => (
                        <tr key={v.key}>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-[var(--foreground)]">{bulkRowName(v, locale)}</span>
                            {v.description && <span className="mt-0.5 block text-xs text-[var(--foreground)]/55">{v.description}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-[var(--foreground)]">{fmt(v.price)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ))}
            </div>
            <div className="mt-4 space-y-1 text-xs text-[var(--foreground)]/55">
              <p>{t("landing.bulkMinNote", { min: fmt(MINIMUM_BULK_VALUE) })}</p>
              <p>{t("landing.bulkCountsNote")}</p>
            </div>
          </DataCard>
        </div>
      </div>
    </section>
  );
}
