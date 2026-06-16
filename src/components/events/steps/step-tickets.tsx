"use client";

import { Plus, Trash2, Store } from "lucide-react";
import { ENTRY_CURRENCIES, ENTRY_PRICE_MODES, ENTRY_PRICE_MODE_LABELS_NL } from "@/lib/events/types";
import type { EventFormState, EventFieldSetter, TicketTypeInput } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border" />
      {label}
    </label>
  );
}

export function StepTickets({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  function updateTicket(i: number, patch: Partial<TicketTypeInput>) {
    set("ticketTypes", form.ticketTypes.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addTicket() {
    set("ticketTypes", [...form.ticketTypes, { name: "", price: "" }]);
  }
  function removeTicket(i: number) {
    set("ticketTypes", form.ticketTypes.filter((_, idx) => idx !== i));
  }

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Tickets & toegang</h2>

      {/* Entree gratis/betaald */}
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
          {/* Prijsmodel */}
          <div>
            <p className={labelClass}>Prijsmodel</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ENTRY_PRICE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("entryPriceMode", mode)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.entryPriceMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {ENTRY_PRICE_MODE_LABELS_NL[mode]}
                </button>
              ))}
            </div>
          </div>

          {/* Valuta */}
          <div className="sm:max-w-[8rem]">
            <label className={labelClass} htmlFor="evt-currency">Valuta</label>
            <select id="evt-currency" value={form.entryCurrency} onChange={(e) => set("entryCurrency", e.target.value)} className={`mt-1 ${inputClass}`}>
              {ENTRY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Enkele prijs of vanaf-prijs */}
          {form.entryPriceMode !== "TIERS" ? (
            <div className="sm:max-w-[10rem]">
              <label className={labelClass} htmlFor="evt-price">
                {form.entryPriceMode === "FROM" ? "Prijs vanaf" : "Prijs"}
              </label>
              <input
                id="evt-price"
                type="number" min="0" step="0.01"
                value={form.entryPrice}
                onChange={(e) => set("entryPrice", e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          ) : (
            /* Meerdere ticket-soorten */
            <div>
              <p className={labelClass}>Ticket-soorten</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bijvoorbeeld: Standaard €5, VIP €15, Kind €0.</p>
              <div className="mt-2 space-y-2">
                {form.ticketTypes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={t.name}
                      onChange={(e) => updateTicket(i, { name: e.target.value })}
                      placeholder="Naam (bv. VIP)"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="number" min="0" step="0.01"
                      value={t.price}
                      onChange={(e) => updateTicket(i, { price: e.target.value })}
                      placeholder="Prijs"
                      className={`${inputClass} w-28`}
                    />
                    {form.ticketTypes.length > 1 && (
                      <button type="button" onClick={() => removeTicket(i)} className="rounded-lg p-2 text-muted-foreground hover:text-rose-500" aria-label="Verwijder">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTicket} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Plus className="h-4 w-4" /> Ticket-soort toevoegen
              </button>
            </div>
          )}

          {/* Kinderen gratis */}
          <div className="sm:max-w-[14rem]">
            <label className={labelClass} htmlFor="evt-children">Kinderen gratis t/m leeftijd</label>
            <input
              id="evt-children"
              type="number" min="1" max="21"
              value={form.childrenFreeUntilAge}
              onChange={(e) => set("childrenFreeUntilAge", e.target.value)}
              placeholder="bv. 12 (leeg = n.v.t.)"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
      )}

      {/* Standhouders */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Store className="h-4 w-4" /> Standhouders <span className="text-xs font-normal text-muted-foreground">(optioneel)</span>
        </p>
        <p className="text-xs text-muted-foreground">Voor verkopers die een plek willen huren op je beurs.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="evt-table">Prijs per tafel</label>
            <input id="evt-table" type="number" min="0" step="0.01" value={form.vendorTablePrice} onChange={(e) => set("vendorTablePrice", e.target.value)} placeholder="bv. 25" className={`mt-1 ${inputClass}`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="evt-chair">Prijs per stoel</label>
            <input id="evt-chair" type="number" min="0" step="0.01" value={form.vendorChairPrice} onChange={(e) => set("vendorChairPrice", e.target.value)} placeholder="bv. 5" className={`mt-1 ${inputClass}`} />
          </div>
        </div>
        <Toggle label="Stroomaansluiting beschikbaar" checked={form.vendorPowerAvailable} onChange={(v) => set("vendorPowerAvailable", v)} />
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

      {/* Inschrijving */}
      <div>
        <Toggle label="Inschrijving / tickets vereist" checked={form.registrationRequired} onChange={(v) => set("registrationRequired", v)} />
        {form.registrationRequired && (
          <div className="mt-3">
            <label className={labelClass} htmlFor="evt-regurl">Aanmeld-/ticketlink <span className="text-rose-500">*</span></label>
            <input id="evt-regurl" type="url" value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} placeholder="https://…" className={`mt-1 ${inputClass}`} />
            <p className="mt-1 text-xs text-muted-foreground">Bezoekers worden via deze link doorverwezen om zich aan te melden of tickets te kopen.</p>
          </div>
        )}
      </div>
    </section>
  );
}
