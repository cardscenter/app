"use client";

import { useTranslations, useLocale } from "next-intl";
import { updateAddress } from "@/actions/address";
import { useActionState, useState } from "react";
import { EUROPEAN_COUNTRIES, getCountryName } from "@/lib/shipping/countries";
import { MapPin, Pencil, Lock, Info } from "lucide-react";
import { getAddressCooldownInfo } from "@/lib/address-cooldown";
import { CountryFlag } from "@/components/ui/country-flag";
import type { User } from "@prisma/client";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT, LABEL, SELECT } from "@/components/ploy/tile-styles";

export function AddressForm({
  user,
  onSaved,
}: {
  user: User;
  /** Fase 43 — optionele callback na succesvol opslaan (onboarding-wizard
   *  schuift ermee door naar de volgende stap). Bestaande callsites
   *  (profiel, verzending) laten 'm weg. */
  onSaved?: () => void;
}) {
  const t = useTranslations("shipping");
  const tc = useTranslations("common");
  const locale = useLocale();

  const hasAddress = !!(user.street && user.city && user.country);
  const cooldown = getAddressCooldownInfo(user.lastAddressChange ?? null);
  const [editing, setEditing] = useState(!hasAddress);

  const [address, setAddress] = useState({
    street: user.street ?? "",
    houseNumber: user.houseNumber ?? "",
    postalCode: user.postalCode ?? "",
    city: user.city ?? "",
    country: user.country ?? "",
  });

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success?: boolean; error?: string } | null | undefined,
      formData: FormData,
    ) => {
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
        onSaved?.();
      }
      return result ?? null;
    },
    null,
  );

  const addressFilled = !!(address.street && address.city && address.country);

  function formatDate(d: Date | string | null): string {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Display mode: show saved address + cooldown info
  if (!editing && addressFilled) {
    const countryName = getCountryName(address.country, locale);
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--pastel-blue-ink)]">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("primaryAddress")}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {address.street} {address.houseNumber}
              </p>
              <p className="text-sm text-foreground">
                {address.postalCode} {address.city}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CountryFlag code={address.country} size="sm" />
                {countryName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!cooldown.canEdit}
            className="cc-pill inline-flex size-9 shrink-0 items-center justify-center border border-[var(--border)] bg-white text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title={cooldown.canEdit ? t("addressEditButton") : tc("edit")}
          >
            {cooldown.canEdit ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Cooldown-info */}
        {cooldown.canEdit && user.lastAddressChange && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 mt-0.5" />
            <span>
              {t("addressLastChanged", {
                date: formatDate(user.lastAddressChange),
              })}
              {" · "}
              {t("addressEditNote")}
            </span>
          </p>
        )}
        {!cooldown.canEdit && cooldown.availableAt && (
          <Callout tone="yellow" icon={Lock}>
            {t("addressLockedUntil", {
              days: cooldown.daysRemaining,
              date: formatDate(cooldown.availableAt),
            })}
          </Callout>
        )}
      </div>
    );
  }

  // Edit mode: show form
  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Callout tone="pink">{state.error}</Callout>
      )}

      {/* Cooldown-warning bovenaan voor de duidelijkheid */}
      {!user.lastAddressChange ? (
        <Callout tone="blue" icon={Info}>
          {t("addressFirstEditFree")}
        </Callout>
      ) : (
        <Callout tone="yellow" icon={Lock}>
          {t("addressEditNote")}
        </Callout>
      )}

      <div>
        <label htmlFor="country" className={LABEL}>
          {t("country")}
        </label>
        <select
          id="country"
          name="country"
          required
          defaultValue={address.country}
          className={SELECT}
        >
          <option value="" disabled>
            {t("selectCountry")}
          </option>
          {EUROPEAN_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {locale === "en" ? c.nameEn : c.nameNl}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="street" className={LABEL}>
            {t("street")}
          </label>
          <input
            id="street"
            name="street"
            type="text"
            required
            defaultValue={address.street}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="houseNumber" className={LABEL}>
            {t("houseNumber")}
          </label>
          <input
            id="houseNumber"
            name="houseNumber"
            type="text"
            required
            defaultValue={address.houseNumber}
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="postalCode" className={LABEL}>
            {t("postalCode")}
          </label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            required
            defaultValue={address.postalCode}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="city" className={LABEL}>
            {t("city")}
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            defaultValue={address.city}
            className={INPUT}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonVariants()}
        >
          {pending ? "..." : tc("save")}
        </button>
        {addressFilled && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={buttonVariants({ variant: "outline" })}
          >
            {tc("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
