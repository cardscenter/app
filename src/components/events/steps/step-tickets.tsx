"use client";

import { Store, Users } from "lucide-react";
import { TicketListEditor } from "@/components/events/ticket-list-editor";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

export function StepTickets({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Tickets & standhouders</h2>

      {/* Gratis / betaald */}
      <div>
        <p className={labelClass}>Entree</p>
        <div className="mt-2 flex gap-2">
          {(["PAID", "FREE"] as const).map((opt) => (
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

      {/* Bezoekers (entree-tickets) */}
      {form.entryType === "PAID" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <Users className="h-4 w-4" /> Bezoekers
          </p>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Maak je eigen tickets aan, bijvoorbeeld Standaard €5, VIP €15 of &ldquo;Kind tot 6 jaar&rdquo; €0.
            </p>
            <TicketListEditor
              items={form.ticketTypes}
              onChange={(items) => set("ticketTypes", items)}
              namePlaceholder="bv. Standaard, VIP, Kind tot 6 jaar"
              addLabel="Ticket toevoegen"
            />
          </div>

          <div>
            <p className={labelClass}>Hoe worden tickets verkocht?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                ["ONLINE", "Online (link)"],
                ["DOOR", "Alleen aan de deur"],
              ] as const).map(([opt, label]) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("ticketSaleMode", opt)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    form.ticketSaleMode === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.ticketSaleMode === "ONLINE" ? (
            <div>
              <label className={labelClass} htmlFor="evt-regurl">Link naar tickets <span className="text-rose-500">*</span></label>
              <input id="evt-regurl" type="url" value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} placeholder="https://…" className={`mt-1 ${inputClass}`} />
              <p className="mt-1 text-xs text-muted-foreground">De pagina waar bezoekers hun tickets kopen of zich aanmelden.</p>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Bezoekers kopen hun tickets aan de deur — geen online link nodig. Dit tonen we zo op de evenementpagina.
            </p>
          )}
        </div>
      )}

      {/* Standhouders */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Store className="h-4 w-4" /> Standhouders <span className="text-xs font-normal text-muted-foreground">(optioneel)</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Huurprijzen voor verkopers — bv. een tafel, stoel of stroomaansluiting. Dit zijn geen tickets; vul zelf in wat je aanbiedt.
        </p>
        <TicketListEditor
          items={form.vendorOptions}
          onChange={(items) => set("vendorOptions", items)}
          namePlaceholder="bv. Tafel, Stoel, Stroom"
          addLabel="Optie toevoegen"
          variant="option"
        />
        <div className="sm:max-w-[14rem]">
          <label className={labelClass} htmlFor="evt-tables">Totaal aantal tafels</label>
          <input
            id="evt-tables"
            type="number" min="1"
            value={form.totalTables}
            onChange={(e) => set("totalTables", e.target.value)}
            placeholder="bv. 40"
            className={`mt-1 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-muted-foreground">Handig voor standhouders — laat leeg indien n.v.t.</p>
        </div>
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
