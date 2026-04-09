"use client";

import { useTranslations, useLocale } from "next-intl";
import { createShippingMethod, updateShippingMethod } from "@/actions/shipping-method";
import { useState } from "react";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { EUROPEAN_COUNTRIES } from "@/lib/shipping/countries";
import { Info } from "lucide-react";
import type { SellerShippingMethod } from "@prisma/client";
import { getDefaultMaxPrice } from "@/lib/shipping/defaults";
import { CarrierLogo } from "@/components/ui/carrier-logo";

interface Props {
  method?: SellerShippingMethod;
  onDone: () => void;
}

export function ShippingMethodForm({ method, onDone }: Props) {
  const t = useTranslations("shipping");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isDefault = method?.isDefault ?? false;
  const maxPrice = isDefault && method ? getDefaultMaxPrice(method.carrier, method.serviceName) : null;

  const existingCountries: string[] = method
    ? JSON.parse(method.countries)
    : [];
  const [selectedCountries, setSelectedCountries] = useState<string[]>(existingCountries);

  const allSelected = selectedCountries.length === EUROPEAN_COUNTRIES.length;

  function toggleCountry(code: string) {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedCountries([]);
    } else {
      setSelectedCountries(EUROPEAN_COUNTRIES.map((c) => c.code));
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (selectedCountries.length === 0) {
      setError(t("selectCountries"));
      setLoading(false);
      return;
    }

    formData.set("countries", JSON.stringify(selectedCountries));

    const result = method
      ? await updateShippingMethod(method.id, formData)
      : await createShippingMethod(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onDone();
    }
  }

  const carrierName = KNOWN_CARRIERS.find((c) => c.id === method?.carrier)?.name ?? method?.carrier;

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Show method name when editing */}
      {method && (
        <div className="flex items-center gap-3 text-foreground">
          <CarrierLogo carrierId={method.carrier} size={32} className="rounded" />
          <p className="text-base font-semibold">
            {carrierName} — {method.serviceName}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pricing tip */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50/80 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{isDefault ? t("defaultPriceOnly") : t("pricingTip")}</p>
      </div>

      {!isDefault && (
        <div>
          <label htmlFor="carrier" className="block text-sm font-medium text-foreground">
            {t("carrier")}
          </label>
          <select
            id="carrier"
            name="carrier"
            required
            defaultValue={method?.carrier ?? ""}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          >
            <option value="" disabled>{t("selectCarrier")}</option>
            {KNOWN_CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      {!isDefault && (
        <div>
          <label htmlFor="shippingType" className="block text-sm font-medium text-foreground">
            {t("shippingTypeLabel")}
          </label>
          <select
            id="shippingType"
            name="shippingType"
            required
            defaultValue={method?.shippingType ?? "PARCEL"}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          >
            <option value="LETTER">{t("typeLetter")}</option>
            <option value="MAILBOX_PARCEL">{t("typeMailboxParcel")}</option>
            <option value="PARCEL">{t("typeParcel")}</option>
          </select>
        </div>
      )}
      {isDefault && (
        <>
          <input type="hidden" name="carrier" value={method?.carrier} />
          <input type="hidden" name="serviceName" value={method?.serviceName} />
          <input type="hidden" name="countries" value={method?.countries} />
          <input type="hidden" name="shippingType" value={method?.shippingType} />
          <input type="hidden" name="isTracked" value={method?.isTracked ? "true" : "false"} />
          <input type="hidden" name="isSigned" value={method?.isSigned ? "true" : "false"} />
        </>
      )}

      {!isDefault && (
        <div>
          <label htmlFor="serviceName" className="block text-sm font-medium text-foreground">
            {t("serviceName")}
          </label>
          <input
            id="serviceName"
            name="serviceName"
            type="text"
            required
            defaultValue={method?.serviceName ?? ""}
            placeholder={t("serviceNamePlaceholder")}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      )}

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-foreground">
          {t("price")}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">&euro;</span>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            max={maxPrice ?? undefined}
            required
            defaultValue={method?.price.toFixed(2) ?? ""}
            className="block w-32 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        {maxPrice != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("maxPrice", { amount: maxPrice.toFixed(2) })}
          </p>
        )}
      </div>

      {/* Tracking & Signed options — only for non-default methods */}
      {!isDefault && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t("shippingType")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="isTracked"
              value="true"
              defaultChecked={method?.isTracked ?? false}
              className="rounded border-border"
            />
            <span className="text-foreground">{t("trackedDescription")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="isSigned"
              value="true"
              defaultChecked={method?.isSigned ?? false}
              className="rounded border-border"
            />
            <span className="text-foreground">{t("signedDescription")}</span>
          </label>
        </div>
      )}

      {/* Countries — only for non-default methods */}
      {!isDefault && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t("countries")}
          </label>
          {/* Select all toggle */}
          <label className="mb-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-primary cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-border"
            />
            {allSelected ? t("deselectAllCountries") : t("selectAllCountries")}
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
            {EUROPEAN_COUNTRIES.map((c) => (
              <label key={c.code} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCountries.includes(c.code)}
                  onChange={() => toggleCountry(c.code)}
                  className="rounded border-border"
                />
                <span className="text-foreground">{locale === "en" ? c.nameEn : c.nameNl}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "..." : tc("save")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          {tc("cancel")}
        </button>
      </div>
    </form>
  );
}
