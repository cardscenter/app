"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toggleShippingMethod, updateShippingSlot } from "@/actions/shipping-method";
import { CarrierLogo } from "@/components/ui/carrier-logo";
import { Loader2, AlertCircle, Lightbulb, RotateCcw, Lock } from "lucide-react";
import type { EnrichedShippingMethod } from "@/components/ui/shipping-method-selector";
import type { CarrierInfo } from "@/lib/shipping/carriers";
import { getCountryName } from "@/lib/shipping/countries";
import { PRICE_OVERRIDE_TOLERANCE, type ShippingService, type ShippingZone } from "@/lib/shipping/tariffs";
import { isRequiredSlot, zonesInScope, type SellingScope } from "@/lib/shipping/static-methods";

const ZONE_ORDER: Record<string, number> = {
  DOMESTIC: 0,
  EU_NEAR: 1,
  EU_FAR: 2,
};

const SERVICE_ORDER: Record<string, number> = {
  MAILBOX_PARCEL: 0,
  PARCEL_STANDARD: 1,
  PARCEL_SIGNED: 2,
};

interface Props {
  methods: EnrichedShippingMethod[];
  availableCarriers: CarrierInfo[];
  hasCountry: boolean;
  /** Lijst van EU_NEAR-buurlanden voor de seller. Gebruikt om het EU_NEAR-kopje te labelen
   *  ("Naar België" i.p.v. generiek "EU-buurland"). */
  neighbors: string[];
  /** Selling-scope van de seller. Bepaalt welke slots verplicht actief zijn (PARCEL_SIGNED in scope-zones). */
  scope: SellingScope;
}

export function ShippingMethodsManager({ methods, availableCarriers, hasCountry, neighbors, scope }: Props) {
  const t = useTranslations("shipping");
  const locale = useLocale();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!hasCountry) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("noCountrySetMessage")}</p>
        <a href="/dashboard/profiel" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          {t("noCountrySetCta")}
        </a>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {t("noMethodsAvailable")}
      </div>
    );
  }

  // Filter op scope: out-of-scope zones tonen we niet — sellers moeten eerst hun
  // verzendgebied uitbreiden voordat die methodes verschijnen. Voorkomt dat ze per
  // ongeluk out-of-scope slots activeren via de toggle.
  const allowedZones = new Set<string>(zonesInScope(scope));
  const byZone: Record<string, EnrichedShippingMethod[]> = { DOMESTIC: [], EU_NEAR: [], EU_FAR: [] };
  for (const m of methods) {
    if (allowedZones.has(m.zone) && byZone[m.zone]) byZone[m.zone].push(m);
  }
  for (const zone of Object.keys(byZone)) {
    byZone[zone].sort((a, b) => (SERVICE_ORDER[a.service] ?? 99) - (SERVICE_ORDER[b.service] ?? 99));
  }

  const neighborNames = neighbors.map((c) => getCountryName(c, locale));
  const neighborLabel = formatList(neighborNames, locale);

  function zoneHeading(zone: string): string {
    if (zone === "DOMESTIC") return t("zone.DOMESTIC");
    if (zone === "EU_NEAR") return t("zone.EU_NEAR_HEADING", { neighbors: neighborLabel });
    return t("zone.EU_FAR");
  }

  function renderRow(method: EnrichedShippingMethod) {
    const required = isRequiredSlot(
      method.zone as ShippingZone,
      method.service as ShippingService,
      scope,
    );
    return (
      <SlotRow
        key={method.id}
        method={method}
        availableCarriers={availableCarriers}
        isPending={pendingId === method.id}
        required={required}
        onToggle={() => {
          if (required) return; // verplicht — geen toggle
          setPendingId(method.id);
          startTransition(async () => {
            await toggleShippingMethod(method.id);
            setPendingId(null);
          });
        }}
        onUpdate={async (patch) => {
          setPendingId(method.id);
          const result = await updateShippingSlot(method.id, patch);
          setPendingId(null);
          return result;
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {(["DOMESTIC", "EU_NEAR", "EU_FAR"] as const)
        .filter((zone) => byZone[zone].length > 0)
        .map((zone) => (
          <section key={zone} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {zoneHeading(zone)}
            </h3>
            {byZone[zone].map(renderRow)}
          </section>
        ))}
    </div>
  );
}

function formatList(names: string[], locale: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const conj = locale === "en" ? "and" : "en";
  if (names.length === 2) return `${names[0]} ${conj} ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} ${conj} ${names[names.length - 1]}`;
}

interface SlotRowProps {
  method: EnrichedShippingMethod;
  availableCarriers: CarrierInfo[];
  isPending: boolean;
  required: boolean;
  onToggle: () => void;
  onUpdate: (patch: { carrier?: string; priceOverride?: number | null }) => Promise<{ error?: string; success?: boolean }>;
}

function SlotRow({ method, availableCarriers, isPending, required, onToggle, onUpdate }: SlotRowProps) {
  const t = useTranslations("shipping");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeCarrier(carrierId: string) {
    setError(null);
    const result = await onUpdate({ carrier: carrierId });
    if (result.error) setError(result.error);
  }

  async function savePriceOverride(override: number | null) {
    setError(null);
    const result = await onUpdate({ priceOverride: override });
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }

  return (
    <div
      className={`rounded-2xl border bg-card p-4 transition-opacity ${
        method.isActive ? "border-border" : "border-border opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <CarrierLogo carrierId={method.carrier} size={32} className="shrink-0 rounded" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-foreground">{t(`service.${method.service}`)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("basePrice")}: €{method.basePrice.toFixed(2)}
          </p>
        </div>

        <select
          value={method.carrier}
          onChange={(e) => changeCarrier(e.target.value)}
          disabled={isPending || !method.isActive}
          className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
        >
          {availableCarriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <PricePopover
          method={method}
          isPending={isPending}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          onSave={savePriceOverride}
        />

        {required ? (
          <span
            title={t("requiredSlotTooltip")}
            className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
          >
            <Lock className="h-3 w-3" />
            {t("requiredSlot")}
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:opacity-50 ${
              method.isActive
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {method.isActive ? t("active") : t("inactive")}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

interface PricePopoverProps {
  method: EnrichedShippingMethod;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (override: number | null) => Promise<boolean>;
}

function PricePopover({ method, isPending, open, onOpenChange, onSave }: PricePopoverProps) {
  const t = useTranslations("shipping");
  const containerRef = useRef<HTMLDivElement>(null);
  const [priceInput, setPriceInput] = useState((method.priceOverride ?? method.basePrice).toFixed(2));
  const [localError, setLocalError] = useState<string | null>(null);

  const minPrice = Math.round(method.basePrice * (1 - PRICE_OVERRIDE_TOLERANCE) * 100) / 100;
  const maxPrice = Math.round(method.basePrice * (1 + PRICE_OVERRIDE_TOLERANCE) * 100) / 100;

  // Sync input wanneer popover opent of method-data verandert (na save)
  useEffect(() => {
    if (open) {
      setPriceInput((method.priceOverride ?? method.basePrice).toFixed(2));
      setLocalError(null);
    }
  }, [open, method.priceOverride, method.basePrice]);

  // Click-outside + Escape sluiten
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  async function handleSave() {
    setLocalError(null);
    const num = parseFloat(priceInput);
    if (isNaN(num)) {
      setLocalError(t("priceInvalid"));
      return;
    }
    const override = Math.abs(num - method.basePrice) < 0.005 ? null : num;
    const success = await onSave(override);
    if (success) onOpenChange(false);
  }

  async function handleReset() {
    const success = await onSave(null);
    if (success) onOpenChange(false);
  }

  const hasOverride = method.priceOverride !== null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        disabled={!method.isActive || isPending}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="rounded-lg border border-border bg-background px-3 py-1 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        €{method.effectivePrice.toFixed(2)}
        {hasOverride && (
          <span className="ml-1 text-xs text-muted-foreground">{t("overridden")}</span>
        )}
      </button>

      {open && (
        <div role="dialog" className="absolute right-0 top-full z-50 pt-2">
          <div className="w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-lg shadow-black/10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("priceEditTitle")}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t("priceEditLabel")}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min={minPrice}
                    max={maxPrice}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("priceRangeHint", { min: minPrice.toFixed(2), max: maxPrice.toFixed(2) })}
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 ring-1 ring-amber-500/10">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                    {t("priceTipBuyerAttractive")}
                  </p>
                </div>
              </div>

              {localError && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" /> {localError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : t("save")}
                </button>
                {hasOverride && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isPending}
                    title={t("priceResetToBase")}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("priceReset")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
