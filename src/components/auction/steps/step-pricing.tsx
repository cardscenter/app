"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Sparkles, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PricingInfoBlock } from "@/components/ui/pricing-info-block";
import { InfoPopup } from "@/components/ui/info-tooltip";
import type { CardPricingSnapshot } from "@/components/ui/card-search-select";
import { MIN_STARTING_BID } from "@/lib/validations/auction";
import { PricingHelperModal } from "@/components/auction/pricing-helper-modal";

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
  const [helperOpen, setHelperOpen] = useState(false);

  // Real-time validatie — mirrort de Zod-regels in src/lib/validations/auction.ts
  // zodat de seller geen rondreis naar het sticky-bottom hoeft te maken om te
  // weten dat er iets niet klopt. Errors zijn null als regel niet aktief is
  // (bijv. velden niet ingevuld of toggle uit).
  const startBidNum = typeof startingBid === "number" && !Number.isNaN(startingBid) ? startingBid : null;
  // Toon de waarschuwing voor élke ingevulde waarde onder €5 — inclusief 0 en
  // negatieve invoer. Alleen bij leeg (null) blijft de hint neutraal.
  const startBidTooLow = startBidNum !== null && startBidNum < MIN_STARTING_BID;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{t("stepPricing")}</h2>
        <button
          type="button"
          onClick={() => setHelperOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <Sparkles className="size-3.5" />
          {t("pricingHelperTrigger")}
        </button>
      </div>

      <PricingHelperModal
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        defaultValue={pricing?.avg ?? null}
        onApply={(advice) => {
          onChange("startingBid", advice.startingBid);
          if (advice.reservePrice !== null) {
            onChange("hasReserve", true);
            onChange("reservePrice", advice.reservePrice);
          } else {
            onChange("hasReserve", false);
          }
          if (advice.buyNowPrice !== null) {
            onChange("hasBuyNow", true);
            onChange("buyNowPrice", advice.buyNowPrice);
          } else {
            onChange("hasBuyNow", false);
          }
          // Looptijd zit in step-timing maar wordt hier alvast doorgezet.
          onChange("duration", advice.duration);
        }}
      />

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
            min={MIN_STARTING_BID}
            value={startingBid ?? ""}
            onKeyDown={(e) => {
              // Blokkeer minteken en scientific-notation invoer (-, e, +).
              if (e.key === "-" || e.key === "e" || e.key === "+") e.preventDefault();
            }}
            onChange={(e) => {
              if (!e.target.value) {
                onChange("startingBid", null);
                return;
              }
              const parsed = parseFloat(e.target.value);
              if (Number.isNaN(parsed)) return;
              // Defense-in-depth tegen paste / browser autofill van negatieve waardes.
              onChange("startingBid", parsed < 0 ? 0 : parsed);
            }}
            aria-invalid={startBidTooLow ? true : undefined}
            className={`block w-48 glass-input px-3 py-2.5 text-foreground ${
              startBidTooLow ? "border-amber-400 dark:border-amber-700" : ""
            }`}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("startingBidMinHint", { min: MIN_STARTING_BID })}</p>
        {startBidTooLow && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-700/40 dark:bg-amber-500/10">
            <Tag className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                {t("startingBidTooLowTitle", { min: MIN_STARTING_BID })}
              </p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                {t("startingBidTooLowBody")}
              </p>
              <Link
                href="/claimsales/nieuw"
                className="mt-1.5 inline-block font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
              >
                {t("startingBidTooLowCta")}
              </Link>
            </div>
          </div>
        )}
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
