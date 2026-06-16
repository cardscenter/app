"use client";

import { timezoneForCountry } from "@/lib/events/timezones";
import { getEventCountryName } from "@/lib/events/countries";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

export function StepDetails({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  const tz = timezoneForCountry(form.country);

  return (
    <section data-section="details" className="scroll-mt-32 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Details</h2>

      <div>
        <label className={labelClass} htmlFor="evt-title">Titel <span className="text-rose-500">*</span></label>
        <input
          id="evt-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={120}
          placeholder="bv. Pokémon Verzamelbeurs Utrecht"
          className={`mt-1 ${inputClass}`}
        />
        <p className="mt-1 text-xs text-muted-foreground">{form.title.length}/120</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="evt-desc">Beschrijving</label>
        <textarea
          id="evt-desc"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={5000}
          rows={5}
          placeholder="Wat kunnen bezoekers verwachten?"
          className={`mt-1 ${inputClass}`}
        />
      </div>

      {/* Datum / tijd */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Wanneer?</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="evt-startdate">Datum <span className="text-rose-500">*</span></label>
            <input
              id="evt-startdate"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="evt-enddate">Einddatum (indien meerdaags)</label>
            <input
              id="evt-enddate"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => set("endDate", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="evt-starttime">Begintijd <span className="text-rose-500">*</span></label>
            <input
              id="evt-starttime"
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="evt-endtime">Eindtijd <span className="text-rose-500">*</span></label>
            <input
              id="evt-endtime"
              type="time"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          🕒 Tijden gelden in de lokale tijdzone van het evenement
          ({getEventCountryName(form.country, "nl")} · {tz}). Bezoekers zien de tijd in hun eigen tijdzone.
        </p>
      </div>

      {/* Toernooi-specifiek */}
      {form.eventType === "OP_TOERNOOI" && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-700/40 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-foreground">Toernooi-informatie</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass} htmlFor="evt-format">Format</label>
              <input
                id="evt-format"
                value={form.tournamentFormat}
                onChange={(e) => set("tournamentFormat", e.target.value)}
                placeholder="bv. Standard, Expanded, Limited"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="evt-prize">Prijzenpot</label>
              <input
                id="evt-prize"
                value={form.prizePool}
                onChange={(e) => set("prizePool", e.target.value)}
                placeholder="bv. Boosterboxen voor top 8"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isSanctioned}
                onChange={(e) => set("isSanctioned", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Officieel gesanctioneerd (TCG+ / Play! Pokémon)
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
