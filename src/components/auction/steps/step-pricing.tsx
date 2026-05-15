"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import { InfoPopup } from "@/components/ui/info-tooltip";
import type { CardPricingSnapshot } from "@/components/ui/card-search-select";

interface StepPricingProps {
  startingBid: number | null;
  hasReserve: boolean;
  reservePrice: number | null;
  hasBuyNow: boolean;
  buyNowPrice: number | null;
  runnerUpEnabled: boolean;
  maxRunnerUpAttempts: number;
  pricing?: CardPricingSnapshot | null;
  onChange: (field: string, value: unknown) => void;
}

export function StepPricing({
  startingBid,
  hasReserve,
  reservePrice,
  hasBuyNow,
  buyNowPrice,
  runnerUpEnabled,
  maxRunnerUpAttempts,
  pricing,
  onChange,
}: StepPricingProps) {
  const t = useTranslations("auction");

  // Real-time validatie — mirrort de Zod-regels in src/lib/validations/auction.ts
  // zodat de seller geen rondreis naar het sticky-bottom hoeft te maken om te
  // weten dat er iets niet klopt. Errors zijn null als regel niet aktief is
  // (bijv. velden niet ingevuld of toggle uit).
  const startBidNum = typeof startingBid === "number" && !Number.isNaN(startingBid) ? startingBid : null;
  const reserveNum =
    hasReserve && typeof reservePrice === "number" && !Number.isNaN(reservePrice) && reservePrice > 0
      ? reservePrice
      : null;
  const buyNowNum =
    hasBuyNow && typeof buyNowPrice === "number" && !Number.isNaN(buyNowPrice) && buyNowPrice > 0
      ? buyNowPrice
      : null;

  const reserveError =
    reserveNum !== null && startBidNum !== null && reserveNum < startBidNum
      ? t("validationReserveBelowStart")
      : null;

  const buyNowVsStartError =
    buyNowNum !== null && startBidNum !== null && buyNowNum <= startBidNum
      ? t("validationBuyNowBelowStart")
      : null;
  const buyNowVsReserveError =
    buyNowNum !== null && reserveNum !== null && buyNowNum <= reserveNum
      ? t("validationBuyNowBelowReserve")
      : null;
  const buyNowError = buyNowVsStartError ?? buyNowVsReserveError;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t("stepPricing")}</h2>

      {/* Market price — shows when a TCGdex card is picked */}
      {pricing && pricing.avg !== null && (
        <PricingInfoBlock pricing={pricing} variant="full" label="Marktwaarde (richtprijs)" />
      )}

      {/* Starting bid */}
      <div>
        <label htmlFor="startingBid" className="block text-sm font-medium text-foreground">{t("startingBid")}</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">&euro;</span>
          <input
            id="startingBid"
            type="number"
            step="0.01"
            min="0.01"
            value={startingBid ?? ""}
            onChange={(e) => onChange("startingBid", e.target.value ? parseFloat(e.target.value) : null)}
            className="block w-48 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

      {/* Reserve price */}
      <div className="glass-subtle rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">{t("reservePrice")}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t("reservePriceHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("hasReserve", !hasReserve)}
            className={`relative h-6 w-11 rounded-full transition-colors ${hasReserve ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasReserve ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
        {hasReserve && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">&euro;</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={reservePrice ?? ""}
                onChange={(e) => onChange("reservePrice", e.target.value ? parseFloat(e.target.value) : null)}
                aria-invalid={reserveError ? true : undefined}
                className={`block w-48 glass-input px-3 py-2.5 text-foreground ${
                  reserveError ? "border-red-400 dark:border-red-700" : ""
                }`}
              />
            </div>
            {reserveError && (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{reserveError}</p>
            )}
          </div>
        )}
      </div>

      {/* Buy now price */}
      <div className="glass-subtle rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">{t("buyNowPrice")}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{t("buyNowPriceHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange("hasBuyNow", !hasBuyNow)}
            className={`relative h-6 w-11 rounded-full transition-colors ${hasBuyNow ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hasBuyNow ? "translate-x-5" : ""}`}
            />
          </button>
        </div>
        {hasBuyNow && (
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">&euro;</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={buyNowPrice ?? ""}
                onChange={(e) => onChange("buyNowPrice", e.target.value ? parseFloat(e.target.value) : null)}
                aria-invalid={buyNowError ? true : undefined}
                className={`block w-48 glass-input px-3 py-2.5 text-foreground ${
                  buyNowError ? "border-red-400 dark:border-red-700" : ""
                }`}
              />
            </div>
            {buyNowError && (
              <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{buyNowError}</p>
            )}
          </div>
        )}
      </div>

      {/* Runner-up rotation */}
      {maxRunnerUpAttempts === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Doorgeven aan op één na hoogste bieder staat uit</p>
              <p className="mt-1 text-xs text-muted-foreground">
                In je profiel-instellingen heb je runner-up rotatie op 0 staan. Als de winnaar van deze veiling niet betaalt, wordt de veiling direct gesloten zonder een aanbod aan de volgende bieder.
              </p>
              <Link
                href="/dashboard/profiel"
                className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
              >
                Aanpassen in profiel →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{t("runnerUpEnabled")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Maximaal {maxRunnerUpAttempts}×
                  <InfoPopup
                    title="Maximaal doorschuiven"
                    text={
                      <>
                        Hoe vaak een veiling kan worden doorgegeven aan de volgende bieder bij niet-betaling. Pas dit aan via je profiel-instellingen.
                        <span className="mt-2 block rounded-md border border-border bg-foreground/5 px-2 py-1.5 text-[11px] text-foreground">
                          Jouw ingestelde aantal: <span className="font-semibold">{maxRunnerUpAttempts}</span>
                        </span>
                      </>
                    }
                  />
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t("runnerUpEnabledHelp")}</p>
            </div>
            <button
              type="button"
              onClick={() => onChange("runnerUpEnabled", !runnerUpEnabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${runnerUpEnabled ? "bg-primary" : "bg-muted"}`}
              aria-pressed={runnerUpEnabled}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${runnerUpEnabled ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
