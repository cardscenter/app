"use client";

import { useState } from "react";
import { Plus, X, Ticket } from "lucide-react";
import type { NamePriceInput } from "@/components/events/event-form-types";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

/**
 * Editor voor een lijst van naam+prijs-items (ticket-soorten of standhouder-
 * opties). Je maakt een item aan via het invul-rijtje; toegevoegde items komen
 * eronder als ticket-achtige kaartjes met gestippelde rand.
 */
export function TicketListEditor({
  items,
  onChange,
  currency,
  namePlaceholder,
  addLabel,
}: {
  items: NamePriceInput[];
  onChange: (items: NamePriceInput[]) => void;
  currency: string;
  namePlaceholder: string;
  addLabel: string;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  function add() {
    if (!name.trim()) return;
    onChange([...items, { name: name.trim(), price: price === "" ? "0" : price }]);
    setName("");
    setPrice("");
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

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
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Prijs ({currency})</label>
          <input
            type="number" min="0" step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="0"
            className={`${inputClass} w-full`}
          />
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((t, i) => (
            <div
              key={i}
              className="relative flex items-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 px-3 py-2.5"
            >
              <Ticket className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(t.price) === 0 ? "Gratis" : `${currency} ${Number(t.price).toFixed(2)}`}
                </p>
              </div>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-rose-500" aria-label="Verwijder">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
