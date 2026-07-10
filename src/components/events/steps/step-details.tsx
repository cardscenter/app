"use client";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

export function StepDetails({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
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
        <label className={labelClass}>Beschrijving</label>
        <div className="mt-1">
          <RichTextEditor
            value={form.description}
            onChange={(html) => set("description", html)}
            rows={6}
            placeholder="Wat kunnen bezoekers verwachten? Vertel over de sfeer, verkopers, activiteiten…"
          />
        </div>
      </div>

      {/* Datum / tijd */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Wanneer?</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          De begintijd is de <strong>reguliere</strong> opening — vroege toegang vul je hieronder apart in.
        </p>

        <div className="mt-4 border-t border-border pt-3">
          <div className="sm:max-w-[14rem]">
            <label className={labelClass} htmlFor="evt-vt">Vroege toegang <span className="text-xs font-normal text-muted-foreground">(optioneel)</span></label>
            <input
              id="evt-vt"
              type="time"
              value={form.earlyAccessTime}
              onChange={(e) => set("earlyAccessTime", e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
      </div>

      {/* Organisator */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Organisator</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Wordt het evenement door een bedrijf georganiseerd? Vul dan hier de naam in — anders tonen we je accountnaam.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="evt-orgname">Naam organisator</label>
            <input
              id="evt-orgname"
              value={form.organizerName}
              onChange={(e) => set("organizerName", e.target.value)}
              maxLength={100}
              placeholder="Laat leeg om je accountnaam te gebruiken"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="evt-orgsite">Website (optioneel)</label>
            <input
              id="evt-orgsite"
              type="url"
              inputMode="url"
              value={form.organizerWebsite}
              onChange={(e) => set("organizerWebsite", e.target.value)}
              placeholder="https://…"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
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
