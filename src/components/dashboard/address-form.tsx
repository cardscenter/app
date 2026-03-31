"use client";

import { useTranslations, useLocale } from "next-intl";
import { updateAddress } from "@/actions/address";
import { useActionState, useState } from "react";
import { EUROPEAN_COUNTRIES, getCountryName } from "@/lib/shipping/countries";
import { MapPin, Pencil } from "lucide-react";
import type { User } from "@prisma/client";

export function AddressForm({ user }: { user: User }) {
  const t = useTranslations("shipping");
  const tc = useTranslations("common");
  const locale = useLocale();

  const hasAddress = !!(user.street && user.city && user.country);
  const [editing, setEditing] = useState(!hasAddress);

  // Track saved address locally so we don't need a page refresh
  const [address, setAddress] = useState({
    street: user.street ?? "",
    houseNumber: user.houseNumber ?? "",
    postalCode: user.postalCode ?? "",
    city: user.city ?? "",
    country: user.country ?? "",
  });

  const [state, formAction, pending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null | undefined, formData: FormData) => {
      const result = await updateAddress(formData);
      if (result?.success) {
        setAddress({
          street: formData.get("street") as string,
          houseNumber: formData.get("houseNumber") as string,
          postalCode: formData.get("postalCode") as string,
          city: formData.get("city") as string,
          country: formData.get("country") as string,
        });
        setEditing(false);
      }
      return result ?? null;
    },
    null
  );

  const addressFilled = !!(address.street && address.city && address.country);

  // Display mode: show saved address
  if (!editing && addressFilled) {
    const countryName = getCountryName(address.country, locale);
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("primaryAddress")}</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {address.street} {address.houseNumber}
            </p>
            <p className="text-sm text-foreground">
              {address.postalCode} {address.city}
            </p>
            <p className="text-sm text-muted-foreground">{countryName}</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          title={tc("edit")}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Edit mode: show form
  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-foreground">
          {t("country")}
        </label>
        <select
          id="country"
          name="country"
          required
          defaultValue={address.country}
          className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
        >
          <option value="" disabled>{t("selectCountry")}</option>
          {EUROPEAN_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {locale === "en" ? c.nameEn : c.nameNl}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="street" className="block text-sm font-medium text-foreground">
            {t("street")}
          </label>
          <input
            id="street"
            name="street"
            type="text"
            required
            defaultValue={address.street}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="houseNumber" className="block text-sm font-medium text-foreground">
            {t("houseNumber")}
          </label>
          <input
            id="houseNumber"
            name="houseNumber"
            type="text"
            required
            defaultValue={address.houseNumber}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-foreground">
            {t("postalCode")}
          </label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            required
            defaultValue={address.postalCode}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-foreground">
            {t("city")}
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            defaultValue={address.city}
            className="mt-1 block w-full glass-input px-3 py-2.5 text-foreground"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "..." : tc("save")}
        </button>
        {addressFilled && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            {tc("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
