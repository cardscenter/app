"use client";

import { useState } from "react";
import { Plus, X, Ticket, Table2, Pencil, Check } from "lucide-react";
import type { NamePriceInput } from "@/components/events/event-form-types";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

function PriceInput({ value, onChange, placeholder = "0" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
      <input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} w-full pl-6`} />
    </div>
  );
}

/**
 * Editor voor een lijst van naam+prijs-items. Twee varianten:
 * - "ticket": bezoekers-tickets — ticket-achtige kaartjes met gestippelde rand,
 *   Ticket-icoon en (optioneel) servicekosten.
 * - "option": standhouder-opties (tafel/stoel/stroom) — neutrale rijen met een
 *   tafel-icoon, géén servicekosten. Dit zijn huurprijzen, geen tickets.
 */
export function TicketListEditor({
  items,
  onChange,
  namePlaceholder,
  addLabel,
  variant = "ticket",
  showServiceFee = variant === "ticket",
}: {
  items: NamePriceInput[];
  onChange: (items: NamePriceInput[]) => void;
  namePlaceholder: string;
  addLabel: string;
  variant?: "ticket" | "option";
  showServiceFee?: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  function add() {
    if (!name.trim()) return;
    onChange([...items, { name: name.trim(), price: price === "" ? "0" : price, description: "", serviceFee: "" }]);
    setName("");
    setPrice("");
  }
  function update(i: number, patch: Partial<NamePriceInput>) {
    onChange(items.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
    if (editing === i) setEditing(null);
  }

  const ItemIcon = variant === "ticket" ? Ticket : Table2;
  const itemCardClass =
    variant === "ticket"
      ? "rounded-lg border-2 border-dashed border-border bg-muted/40 px-3 py-2.5"
      : "rounded-lg border border-border bg-card px-3 py-2.5";
  const extraInfoLabel =
    variant === "ticket" ? "Extra info (bv. wat krijg je bij dit ticket)" : "Extra info (bv. afmetingen of wat is inbegrepen)";
  const extraInfoPlaceholder =
    variant === "ticket" ? "bv. inclusief goodiebag + vroege toegang" : "bv. tafel van 180 cm, incl. 2 stoelen";

  return (
    <div className="space-y-3">
      {/* Toevoeg-rij */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[10rem]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Naam</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={namePlaceholder}
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Prijs</label>
          <PriceInput value={price} onChange={setPrice} />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>

      {/* Toegevoegde items als ticket-kaartjes */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {items.map((t, i) => {
            const isEditing = editing === i;
            const priceNum = Number(t.price || 0);
            const feeNum = Number(t.serviceFee || 0);
            return (
              <div key={i} className={itemCardClass}>
                {!isEditing ? (
                  <div className="flex items-center gap-3">
                    <ItemIcon className={`h-7 w-7 shrink-0 ${variant === "ticket" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{t.name}</p>
                      {t.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing(i)}
                          className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
                        >
                          + Beschrijving toevoegen
                        </button>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-foreground">{priceNum === 0 ? "Gratis" : `€ ${priceNum.toFixed(2)}`}</p>
                      {feeNum > 0 && <p className="text-[11px] text-muted-foreground">+ € {feeNum.toFixed(2)} servicekosten</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" onClick={() => setEditing(i)} className="text-muted-foreground hover:text-primary" aria-label="Bewerken"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-rose-500" aria-label="Verwijder"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[10rem]">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Naam</label>
                        <input value={t.name} onChange={(e) => update(i, { name: e.target.value })} className={`${inputClass} w-full`} />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Prijs</label>
                        <PriceInput value={t.price} onChange={(v) => update(i, { price: v })} />
                      </div>
                      {showServiceFee && (
                        <div className="w-28">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Servicekosten</label>
                          <PriceInput value={t.serviceFee} onChange={(v) => update(i, { serviceFee: v })} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">{extraInfoLabel}</label>
                      <input value={t.description} onChange={(e) => update(i, { description: e.target.value })} placeholder={extraInfoPlaceholder} className={`${inputClass} w-full`} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-rose-500"><X className="h-4 w-4" /> Verwijderen</button>
                      <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Check className="h-4 w-4" /> Klaar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
