"use client";

import { useTranslations, useLocale } from "next-intl";
import { createShippingMethod, updateShippingMethod } from "@/actions/shipping-method";
import { useState } from "react";
import { KNOWN_CARRIERS } from "@/lib/shipping/carriers";
import { EUROPEAN_COUNTRIES } from "@/lib/shipping/countries";
import { Info } from "lucide-react";
import type { SellerShippingMethod } from "@prisma/client";

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

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pricing tip */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50/80 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t("pricingTip")}</p>
      </div>

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
            required
            defaultValue={method?.price.toFixed(2) ?? ""}
            className="block w-32 glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

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
