"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, ArrowLeft, ArrowRight, Info, Package2, Weight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { PayoutMethodSelect } from "./payout-method-select";
import { BuybackSuccess } from "./buyback-success";
import { BulkFaq } from "./bulk-faq";
import { submitBulkBuyback } from "@/actions/buyback";
import { MINIMUM_BULK_VALUE, MAX_SHIPPING_WEIGHT_KG } from "@/lib/buyback-pricing";

export interface BulkPricingOption {
  key: string;
  label: string;
  tooltip: string | null;
  price: number;
  group: "pokemon" | "other";
  weightGrams: number;
}

interface BulkCalculatorProps {
  /** Tarieven uit de beheerbare tabel (Fase 6), al vertaald. */
  pricing: BulkPricingOption[];
  defaultIban?: string;
  defaultAccountHolder?: string;
}

export function BulkCalculator({ pricing, defaultIban = "", defaultAccountHolder = "" }: BulkCalculatorProps) {
  const t = useTranslations("buyback");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(pricing.map((p) => [p.key, 0]))
  );

  // Payout (alleen bank, Fase 6)
  const [iban, setIban] = useState(defaultIban);
  const [accountHolder, setAccountHolder] = useState(defaultAccountHolder);

  // Confirmation
  const [confirmNM, setConfirmNM] = useState(false);
  const [confirmSorted, setConfirmSorted] = useState(false);
  const [confirmBinding, setConfirmBinding] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);

  const [successId, setSuccessId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionState, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await submitBulkBuyback(formData);
      // Uitkomst direct hier afhandelen (i.p.v. in een effect op actionState).
      if (result?.success && result.requestId) {
        setSuccessId(result.requestId);
        setStep(3);
        toast.success(t("successTitle"));
      } else if (result?.error) {
        toast.error(result.error);
      }
      return result ?? null;
    },
    null
  );

  // Bij elke stap-overgang naar boven scrollen — relevant op step 2/3 omdat
  // de gebruiker anders nog onderaan de calculator-tabel staat.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  // Category rows — grouped by pokemon/other for display + semantics
  const allCategories = pricing.map((config) => {
    const qty = quantities[config.key] || 0;
    return {
      key: config.key,
      label: config.label,
      tooltip: config.tooltip ?? undefined,
      price: config.price,
      group: config.group,
      weightGrams: config.weightGrams,
      quantity: qty,
      subtotal: Math.round(qty * config.price * 100) / 100,
    };
  });

  const pokemonCategories = allCategories.filter((c) => c.group === "pokemon");
  const otherCategories = allCategories.filter((c) => c.group === "other");

  const pokemonSubtotal = Math.round(pokemonCategories.reduce((s, c) => s + c.subtotal, 0) * 100) / 100;
  const otherSubtotal = Math.round(otherCategories.reduce((s, c) => s + c.subtotal, 0) * 100) / 100;
  const total = Math.round((pokemonSubtotal + otherSubtotal) * 100) / 100;

  const totalCards = pokemonCategories.reduce((s, c) => s + c.quantity, 0);
  const totalOtherItems = otherCategories.reduce((s, c) => s + c.quantity, 0);
  const hasAny = totalCards + totalOtherItems > 0;
  const minimumMet = total >= MINIMUM_BULK_VALUE;
  const progressPct = Math.min(100, (total / MINIMUM_BULK_VALUE) * 100);

  // Shipping advice — totaal gewicht, aantal pakketten (max 22 kg elk), en
  // GELIJKE verdeling i.p.v. één bijna-vol pakket + één bijna-leeg. Maakt de
  // pakket-visualisatie overzichtelijker: 27 kg → 2× 13.5 kg i.p.v. 22 + 5.
  const totalWeightGrams = allCategories.reduce((s, c) => s + c.quantity * c.weightGrams, 0);
  const totalWeightKg = totalWeightGrams / 1000;
  const packagesNeeded = totalWeightKg === 0 ? 0 : Math.max(1, Math.ceil(totalWeightKg / MAX_SHIPPING_WEIGHT_KG));
  const weightPerPackageKg =
    packagesNeeded === 0 ? 0 : Math.round((totalWeightKg / packagesNeeded) * 100) / 100;
  const fillPctPerPackage =
    packagesNeeded === 0 ? 0 : Math.min(100, (weightPerPackageKg / MAX_SHIPPING_WEIGHT_KG) * 100);

  function setQty(key: string, next: number) {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, Math.min(99999, next)) }));
  }

  function handleSubmit() {
    const bulkItems = allCategories
      .filter((c) => c.quantity > 0)
      .map((c) => ({ category: c.key, quantity: c.quantity }));

    const formData = new FormData();
    formData.set("bulkItems", JSON.stringify(bulkItems));
    formData.set("payoutMethod", "BANK");
    formData.set("iban", iban);
    formData.set("accountHolder", accountHolder);
    formData.set("confirmNearMint", String(confirmNM));
    formData.set("confirmSorted", String(confirmSorted));
    formData.set("confirmBinding", String(confirmBinding));

    startTransition(() => formAction(formData));
  }

  if (step === 3 && successId) {
    return <BuybackSuccess requestId={successId} />;
  }

  return (
    <div className="space-y-8 pb-32">
      {step === 1 && (
        <>
          {/* Unified categories table — Pokémon + Overig in één tabel met
              identieke kolomuitlijning. Sectie-headers staan als bold rij
              tussen de groepen zodat alles netjes verticaal aansluit. */}
          <UnifiedCategoryTable
            sections={[
              {
                title: t("bulkSectionPokemon"),
                description: t("bulkSectionPokemonDesc"),
                rightLabel: t("totalCards"),
                rightValue: totalCards,
                categories: pokemonCategories,
              },
              {
                title: t("bulkSectionOther"),
                description: t("bulkSectionOtherDesc"),
                categories: otherCategories,
              },
            ]}
            onChange={setQty}
          />

          {/* Shipping advice section — visueel onderscheiden van de calculator */}
          <ShippingAdvice
            totalWeightKg={totalWeightKg}
            packagesNeeded={packagesNeeded}
            weightPerPackageKg={weightPerPackageKg}
            fillPctPerPackage={fillPctPerPackage}
          />

          <BulkFaq />

          {/* Sticky totals bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {minimumMet
                        ? t("bulkMinimumMet", { amount: `€${MINIMUM_BULK_VALUE.toFixed(0)}` })
                        : t("bulkMinimumRemaining", { amount: `€${(MINIMUM_BULK_VALUE - total).toFixed(2)}` })}
                    </span>
                    <span className="font-medium tabular-nums text-muted-foreground">
                      €{total.toFixed(2)} / €{MINIMUM_BULK_VALUE.toFixed(0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        minimumMet ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("totalCards")}</p>
                    <p className="font-semibold tabular-nums text-foreground">
                      {totalCards.toLocaleString("nl-NL")}
                    </p>
                  </div>
                  {totalOtherItems > 0 && (
                    <div>
                      <p className="text-muted-foreground">{t("totalOther")}</p>
                      <p className="font-semibold tabular-nums text-foreground">
                        {totalOtherItems.toLocaleString("nl-NL")}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">{t("estimatedPayout")}</p>
                    <p className="cc-display text-3xl tabular-nums text-[var(--foreground)]">€{total.toFixed(2)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!hasAny || !minimumMet}
                  className="flex items-center gap-2 cc-pill cc-grad px-6 py-4 text-sm font-semibold leading-none text-white disabled:cursor-not-allowed disabled:bg-[var(--muted)] disabled:text-[var(--foreground)]/45"
                >
                  {t("nextStep")} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: confirmation */}
      {step === 2 && (
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("previousStep")}
          </button>

          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{t("confirmation")}</h2>

          {pokemonCategories.some((c) => c.quantity > 0) && (
            <SummaryTable
              title={t("bulkSectionPokemon")}
              rows={pokemonCategories.filter((c) => c.quantity > 0)}
              totalLabel={t("totalCards")}
              totalQty={totalCards}
              totalValue={pokemonSubtotal}
            />
          )}

          {otherCategories.some((c) => c.quantity > 0) && (
            <SummaryTable
              title={t("bulkSectionOther")}
              rows={otherCategories.filter((c) => c.quantity > 0)}
              totalLabel={t("totalOther")}
              totalQty={totalOtherItems}
              totalValue={otherSubtotal}
            />
          )}

          <div className="flex items-center justify-between rounded-[12px] bg-[var(--pastel-green)] px-5 py-4">
            <span className="text-sm font-semibold">{t("total")}</span>
            <span className="cc-display text-3xl tabular-nums text-[var(--foreground)]">€{total.toFixed(2)}</span>
          </div>

          <PayoutMethodSelect
            iban={iban}
            onIbanChange={setIban}
            accountHolder={accountHolder}
            onAccountHolderChange={setAccountHolder}
            estimatedPayout={total}
          />

          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmNM}
                onChange={(e) => setConfirmNM(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmNearMintEnglish")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmSorted}
                onChange={(e) => setConfirmSorted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmSorted")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmBinding}
                onChange={(e) => setConfirmBinding(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>{t("confirmBinding")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmTerms}
                onChange={(e) => setConfirmTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                {t("confirmTermsPrefix")}{" "}
                <Link
                  href="/verkopen/voorwaarden-bulk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {t("confirmTermsLinkLabel")}
                </Link>
                {t("confirmTermsSuffix")}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending ||
              !confirmNM ||
              !confirmSorted ||
              !confirmBinding ||
              !confirmTerms ||
              !minimumMet ||
              !iban ||
              !accountHolder
            }
            className="flex w-full items-center justify-center gap-2 cc-pill bg-[var(--foreground)] px-6 py-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-[var(--foreground)]/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            {isPending ? t("submitting") : t("submitRequest")}
          </button>

          {actionState?.error && (
            <p className="text-center text-sm text-red-500">{actionState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface CategoryRow {
  key: string;
  label: string;
  tooltip?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CategorySectionData {
  title: string;
  description: string;
  rightLabel?: string;
  rightValue?: number;
  categories: CategoryRow[];
}

interface UnifiedCategoryTableProps {
  sections: CategorySectionData[];
  onChange: (key: string, next: number) => void;
}

/**
 * Single shared table for all bulk categories. Both the Pokémon group and
 * the Overig group live inside one `<table>` so kolombreedtes — en daarmee
 * uitlijning van Aantal en Subtotaal — exact gelijk lopen tussen de groepen.
 * Sectie-titels worden gerenderd als full-width spanrijen bovenop de
 * categorieën van die groep.
 */
function UnifiedCategoryTable({ sections, onChange }: UnifiedCategoryTableProps) {
  const t = useTranslations("buyback");

  return (
    <section>
      <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)]">
        <table className="w-full table-fixed">
          {/* Vaste kolombreedtes zorgen dat Aantal en Subtotaal in elke
              groep op precies dezelfde positie staan. */}
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("bulkCategory")}</th>
              <th className="px-4 py-3 text-right">{t("bulkPricePerUnit")}</th>
              <th className="px-4 py-3 text-center">{t("quantity")}</th>
              <th className="px-4 py-3 text-right">{t("bulkSubtotal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {sections.map((section, sIdx) => (
              <CategoryGroup
                key={section.title}
                section={section}
                onChange={onChange}
                isFirst={sIdx === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CategoryGroupProps {
  section: CategorySectionData;
  onChange: (key: string, next: number) => void;
  isFirst: boolean;
}

function CategoryGroup({ section, onChange, isFirst }: CategoryGroupProps) {
  return (
    <>
      {/* Sectie-header rij — beslaat alle 4 kolommen */}
      <tr className={`bg-muted/40 ${isFirst ? "" : "border-t-4 border-border/30"}`}>
        <td colSpan={4} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            {section.rightLabel != null && (
              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {section.rightLabel}
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {(section.rightValue ?? 0).toLocaleString("nl-NL")}
                </p>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Categorie rijen */}
      {section.categories.map((cat) => {
        const hasItems = cat.quantity > 0;
        return (
          <tr
            key={cat.key}
            className={`transition-colors ${hasItems ? "bg-emerald-50/40" : "hover:bg-muted/30"}`}
          >
            <td className="truncate px-4 py-3 text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                {cat.label}
                {cat.tooltip && (
                  <span
                    title={cat.tooltip}
                    className="inline-flex cursor-help text-muted-foreground hover:text-foreground"
                    aria-label={cat.tooltip}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
              €{cat.price.toFixed(2)}
            </td>
            <td className="px-4 py-3">
              <input
                type="number"
                min={0}
                max={99999}
                value={cat.quantity || ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  onChange(cat.key, Number.isFinite(n) ? n : 0);
                }}
                className="mx-auto block w-24 rounded-lg border border-input bg-background px-3 py-1.5 text-center text-sm tabular-nums focus:border-primary focus:outline-none"
                placeholder="0"
                inputMode="numeric"
              />
            </td>
            <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
              {hasItems ? (
                <span className="text-emerald-600">€{cat.subtotal.toFixed(2)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

interface ShippingAdviceProps {
  totalWeightKg: number;
  packagesNeeded: number;
  weightPerPackageKg: number;
  fillPctPerPackage: number;
}

function ShippingAdvice({ totalWeightKg, packagesNeeded, weightPerPackageKg, fillPctPerPackage }: ShippingAdviceProps) {
  const t = useTranslations("buyback");
  const formatKg = (kg: number) => kg.toFixed(2).replace(".", ",");
  const hasContents = packagesNeeded > 0;

  // Render up to 6 package tiles inline; beyond that we condense with a "+N meer"
  // indicator so the row doesn't blow up on heavy orders.
  const MAX_INLINE_TILES = 6;
  const tilesToShow = Math.min(packagesNeeded, MAX_INLINE_TILES);
  const extraTiles = Math.max(0, packagesNeeded - MAX_INLINE_TILES);

  return (
    <section className="rounded-[16px] bg-[var(--pastel-blue)] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-200 text-sky-800">
              <Package2 className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">{t("shippingAdviceTitle")}</h2>
            <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
              {t("shippingAdviceBadge")}
            </span>
          </div>
          <p className="mt-1 text-xs text-sky-800/80">
            {t("shippingAdviceDesc", { max: `${MAX_SHIPPING_WEIGHT_KG} kg` })}
          </p>
          <p className="mt-1 text-xs italic text-sky-700/70">
            {t("shippingAdviceNotRequired")}
          </p>
        </div>
      </div>

      {/* Summary numbers */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-[12px] bg-white/70 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Weight className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-sky-800/70">{t("shippingTotalWeight")}</p>
            <p className="cc-display text-3xl tabular-nums text-[var(--foreground)]">
              {formatKg(totalWeightKg)} kg
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[12px] bg-white/70 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Package2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-sky-800/70">{t("shippingPackages")}</p>
            <p className="cc-display text-3xl tabular-nums text-[var(--foreground)]">
              {packagesNeeded.toLocaleString("nl-NL")}
            </p>
          </div>
        </div>
      </div>

      {/* Visual package tiles */}
      {hasContents && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-sky-800">
            {t("shippingPackageBreakdown", {
              n: packagesNeeded,
              weight: `${formatKg(weightPerPackageKg)} kg`,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: tilesToShow }).map((_, i) => (
              <PackageTile
                key={i}
                index={i + 1}
                weightKg={weightPerPackageKg}
                fillPct={fillPctPerPackage}
                weightLabel={formatKg(weightPerPackageKg)}
              />
            ))}
            {extraTiles > 0 && (
              <div className="flex min-h-[96px] min-w-[88px] flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[var(--foreground)]/25 bg-white/40 px-3 text-center text-xs font-semibold text-[var(--foreground)]/70">
                +{extraTiles} {t("shippingMorePackages")}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface PackageTileProps {
  index: number;
  weightKg: number;
  fillPct: number;
  weightLabel: string;
}

function PackageTile({ index, weightKg, fillPct, weightLabel }: PackageTileProps) {
  const nearFull = fillPct > 95;
  return (
    <div className="flex min-w-[88px] flex-col items-center gap-1.5 rounded-[12px] bg-white p-3">
      <div className="relative flex h-14 w-14 items-end justify-center overflow-hidden rounded-lg bg-sky-100">
        {/* Fill level as a rising background */}
        <div
          className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${
            nearFull ? "bg-amber-400/60" : "bg-sky-400/60"
          }`}
          style={{ height: `${Math.max(6, fillPct)}%` }}
          aria-hidden
        />
        <Package2 className="relative z-10 h-7 w-7 text-sky-700" />
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-sky-700/70">
        Pakket {index}
      </p>
      <p className="text-sm font-bold tabular-nums text-[var(--foreground)]">
        {weightLabel} kg
      </p>
      <p className="text-[10px] tabular-nums text-sky-700/70">
        {Math.round(fillPct)}% {weightKg > 0 ? "vol" : ""}
      </p>
    </div>
  );
}

interface SummaryTableProps {
  title: string;
  rows: { key: string; label: string; price: number; quantity: number; subtotal: number }[];
  totalLabel: string;
  totalQty: number;
  totalValue: number;
}

function SummaryTable({ title, rows, totalLabel, totalQty, totalValue }: SummaryTableProps) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white shadow-[0_2px_8px_0_var(--cc-border-subtle)]">
      <div className="border-b border-border/40 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border/30">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-4 py-2 font-medium">{row.label}</td>
              <td className="px-4 py-2 text-center text-muted-foreground tabular-nums">
                {row.quantity}× €{row.price.toFixed(2)}
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">€{row.subtotal.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="bg-muted/20 text-sm font-semibold">
            <td className="px-4 py-2">{totalLabel}</td>
            <td className="px-4 py-2 text-center tabular-nums">{totalQty}</td>
            <td className="px-4 py-2 text-right tabular-nums">€{totalValue.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
