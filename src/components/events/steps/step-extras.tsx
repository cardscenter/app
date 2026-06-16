"use client";

import { ENTRY_CURRENCIES } from "@/lib/events/types";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  );
}

export function StepExtras({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section data-section="extras" className="scroll-mt-32 space-y-5">
      <h2 className="text-lg font-semibold text-foreground">Extra&apos;s</h2>
      <p className="text-sm text-muted-foreground">Allemaal optioneel — vul in wat van toepassing is.</p>

      {/* Entree */}
      <div>
        <p className={labelClass}>Entree</p>
        <div className="mt-2 flex gap-2">
          {(["FREE", "PAID"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => set("entryType", opt)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                form.entryType === opt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt === "FREE" ? "Gratis" : "Betaald"}
            </button>
          ))}
        </div>
        {form.entryType === "PAID" && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
            <div>
              <label className={labelClass} htmlFor="evt-price">Prijs</label>
              <input
                id="evt-price"
                type="number"
                min="0"
                step="0.01"
                value={form.entryPrice}
                onChange={(e) => set("entryPrice", e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="evt-currency">Valuta</label>
              <select
                id="evt-currency"
                value={form.entryCurrency}
                onChange={(e) => set("entryCurrency", e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                {ENTRY_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Activiteiten */}
      <div>
        <p className={labelClass}>Wat kan er?</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Toggle label="Spelen" checked={form.canPlay} onChange={(v) => set("canPlay", v)} />
          <Toggle label="Ruilen" checked={form.canTrade} onChange={(v) => set("canTrade", v)} />
          <Toggle label="Verkopen" checked={form.canSell} onChange={(v) => set("canSell", v)} />
        </div>
      </div>

      {/* Faciliteiten */}
      <div>
        <p className={labelClass}>Faciliteiten</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle label="Parkeergelegenheid" checked={form.hasParking} onChange={(v) => set("hasParking", v)} />
          <Toggle label="Eten & drinken" checked={form.hasFood} onChange={(v) => set("hasFood", v)} />
        </div>
      </div>

      {/* Capaciteit */}
      <div className="sm:max-w-xs">
        <label className={labelClass} htmlFor="evt-max">Max. aantal bezoekers</label>
        <input
          id="evt-max"
          type="number"
          min="1"
          value={form.maxVisitors}
          onChange={(e) => set("maxVisitors", e.target.value)}
          placeholder="Onbeperkt"
          className={`mt-1 ${inputClass}`}
        />
      </div>

      {/* Inschrijving */}
      <div>
        <Toggle
          label="Inschrijving / tickets vereist"
          checked={form.registrationRequired}
          onChange={(v) => set("registrationRequired", v)}
        />
        {form.registrationRequired && (
          <div className="mt-3">
            <label className={labelClass} htmlFor="evt-regurl">Aanmeld-/ticketlink <span className="text-rose-500">*</span></label>
            <input
              id="evt-regurl"
              type="url"
              value={form.registrationUrl}
              onChange={(e) => set("registrationUrl", e.target.value)}
              placeholder="https://…"
              className={`mt-1 ${inputClass}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Bezoekers worden via deze link doorverwezen om zich aan te melden of tickets te kopen.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
