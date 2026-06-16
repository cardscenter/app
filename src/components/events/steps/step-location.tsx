"use client";

import { EVENT_COUNTRIES } from "@/lib/events/countries";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

export function StepLocation({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section data-section="location" className="scroll-mt-32 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Locatie</h2>
      <p className="text-sm text-muted-foreground">
        Het adres wordt omgezet naar een kaartlocatie (pin) en gebruikt voor afstand-filters.
      </p>

      <div>
        <label className={labelClass} htmlFor="evt-venue">Naam locatie <span className="text-rose-500">*</span></label>
        <input
          id="evt-venue"
          value={form.venueName}
          onChange={(e) => set("venueName", e.target.value)}
          maxLength={150}
          placeholder="bv. Beursgebouw De Vereeniging"
          className={`mt-1 ${inputClass}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="evt-street">Straat <span className="text-rose-500">*</span></label>
          <input
            id="evt-street"
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="evt-housenr">Huisnummer <span className="text-rose-500">*</span></label>
          <input
            id="evt-housenr"
            value={form.houseNumber}
            onChange={(e) => set("houseNumber", e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="evt-postal">Postcode <span className="text-rose-500">*</span></label>
          <input
            id="evt-postal"
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="evt-city">Plaats <span className="text-rose-500">*</span></label>
          <input
            id="evt-city"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="evt-country">Land <span className="text-rose-500">*</span></label>
          <div className="mt-1 flex items-center gap-2">
            <CountryFlag code={form.country} size="md" />
            <select
              id="evt-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className={inputClass}
            >
              {EVENT_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameNl}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
