"use client";

import { Store } from "lucide-react";
import { ENTRY_CURRENCIES } from "@/lib/events/types";
import { TicketListEditor } from "@/components/events/ticket-list-editor";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

export function StepTickets({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Tickets & toegang</h2>

      {/* Gratis / betaald */}
      <div>
        <p className={labelClass}>Entree</p>
        <div className="mt-2 flex gap-2">
          {(["FREE", "PAID"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => set("entryType", opt)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                form.entryType === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt === "FREE" ? "Gratis" : "Betaald"}
            </button>
          ))}
        </div>
      </div>

      {form.entryType === "PAID" && (
        <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
          {/* Valuta */}
          <div className="sm:max-w-[8rem]">
            <label className={labelClass} htmlFor="evt-currency">Valuta</label>
            <select id="evt-currency" value={form.entryCurrency} onChange={(e) => set("entryCurrency", e.target.value)} className={`mt-1 ${inputClass}`}>
              {ENTRY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Ticket-soorten */}
          <div>
            <p className={labelClass}>Ticket-soorten</p>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Maak je eigen tickets aan, bijvoorbeeld Standaard €5 of VIP €15. Een prijs van 0 betekent gratis.
            </p>
            <TicketListEditor
              items={form.ticketTypes}
              onChange={(items) => set("ticketTypes", items)}
              currency={form.entryCurrency}
              namePlaceholder="bv. Standaard, VIP, Kind"
              addLabel="Ticket toevoegen"
            />
          </div>

          {/* Ticketlink — alleen tonen zodra er minstens één ticket is */}
          {form.ticketTypes.length > 0 && (
            <div>
              <label className={labelClass} htmlFor="evt-regurl">Link naar tickets (optioneel)</label>
              <input id="evt-regurl" type="url" value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} placeholder="https://…" className={`mt-1 ${inputClass}`} />
              <p className="mt-1 text-xs text-muted-foreground">Externe pagina waar bezoekers tickets kunnen kopen of zich aanmelden.</p>
            </div>
          )}

          {/* Kinderen gratis */}
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={form.childrenFreeEnabled}
                onChange={(e) => set("childrenFreeEnabled", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Gratis toegang voor kinderen?
            </label>
            {form.childrenFreeEnabled && (
              <div className="mt-2 sm:max-w-[14rem]">
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="evt-children">Gratis t/m leeftijd</label>
                <input
                  id="evt-children"
                  type="number" min="1" max="21"
                  value={form.childrenFreeUntilAge}
                  onChange={(e) => set("childrenFreeUntilAge", e.target.value)}
                  placeholder="bv. 12"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Standhouders */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Store className="h-4 w-4" /> Standhouders <span className="text-xs font-normal text-muted-foreground">(optioneel)</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Voor verkopers die iets willen huren of bijkopen — bv. een tafel, stoel of stroomaansluiting. Vul zelf in wat je aanbiedt.
        </p>
        <TicketListEditor
          items={form.vendorOptions}
          onChange={(items) => set("vendorOptions", items)}
          currency={form.entryCurrency}
          namePlaceholder="bv. Tafel, Stoel, Stroom"
          addLabel="Optie toevoegen"
        />
        <div>
          <label className={labelClass} htmlFor="evt-vendorinfo">Extra info voor standhouders</label>
          <textarea
            id="evt-vendorinfo"
            value={form.vendorInfo}
            onChange={(e) => set("vendorInfo", e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Hoe kunnen standhouders zich aanmelden? Voorwaarden?"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>
    </section>
  );
}
