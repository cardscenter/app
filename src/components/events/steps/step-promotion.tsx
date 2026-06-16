"use client";

import { Megaphone, Home, LayoutGrid, X } from "lucide-react";
import {
  EVENT_UPSELL_TYPES,
  EVENT_UPSELL_LABELS_NL,
  calculateEventUpsellCost,
  type EventUpsellType,
} from "@/lib/events/upsell-config";
import {
  availableEventLabelsFor,
  calculateEventLabelCost,
  EVENT_LABEL_TEXT_NL,
  LABEL_COLORS,
  COLOR_HEX,
  COLOR_CLASSES,
  MAX_LABELS_PER_EVENT,
  type EventLabelType,
  type LabelColor,
} from "@/lib/events/labels";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const UPSELL_ICON: Record<EventUpsellType, React.ComponentType<{ className?: string }>> = {
  HOMEPAGE_SPOTLIGHT: Home,
  CATEGORY_HIGHLIGHT: LayoutGrid,
};

export function StepPromotion({
  form,
  set,
  accountType,
}: {
  form: EventFormState;
  set: EventFieldSetter;
  accountType: string;
}) {
  const availability = availableEventLabelsFor({
    entryType: form.entryType,
    isSanctioned: form.isSanctioned,
    maxVisitors: form.maxVisitors ? Number(form.maxVisitors) : null,
    canTrade: form.canTrade,
  });
  const availableTypes = new Set(availability.filter((a) => a.available).map((a) => a.type));

  function toggleUpsell(type: EventUpsellType) {
    const exists = form.upsells.find((u) => u.type === type);
    if (exists) {
      set("upsells", form.upsells.filter((u) => u.type !== type));
    } else {
      set("upsells", [...form.upsells, { type, days: 7 }]);
    }
  }
  function setUpsellDays(type: EventUpsellType, days: number) {
    set("upsells", form.upsells.map((u) => (u.type === type ? { ...u, days } : u)));
  }

  function toggleLabel(type: EventLabelType) {
    const exists = form.labels.find((l) => l.type === type);
    if (exists) {
      set("labels", form.labels.filter((l) => l.type !== type));
    } else if (form.labels.length < MAX_LABELS_PER_EVENT) {
      set("labels", [...form.labels, { type, colorKey: "indigo" }]);
    }
  }
  function setLabelColor(type: EventLabelType, colorKey: LabelColor) {
    set("labels", form.labels.map((l) => (l.type === type ? { ...l, colorKey } : l)));
  }

  const labelsCost = calculateEventLabelCost(form.labels.length);

  return (
    <section data-section="promotion" className="scroll-mt-32 space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Megaphone className="h-5 w-5" /> Promotie
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optioneel — geef je evenement extra zichtbaarheid. Kosten worden van je saldo afgeschreven.
        </p>
      </div>

      {/* Upsells */}
      <div className="space-y-3">
        {EVENT_UPSELL_TYPES.map((type) => {
          const active = form.upsells.find((u) => u.type === type);
          const Icon = UPSELL_ICON[type];
          const days = active?.days ?? 7;
          const cost = calculateEventUpsellCost(type, days, accountType);
          return (
            <div
              key={type}
              className={`rounded-xl border p-4 transition ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!active}
                  onChange={() => toggleUpsell(type)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <Icon className="h-4 w-4" /> {EVENT_UPSELL_LABELS_NL[type]}
                  </span>
                </span>
              </label>
              {active && (
                <div className="mt-3 flex flex-wrap items-center gap-3 pl-7">
                  <label className="text-sm text-muted-foreground">
                    Aantal dagen:
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={days}
                      onChange={(e) => setUpsellDays(type, Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                      className="ml-2 w-20 rounded-lg border border-border bg-background px-2 py-1 text-base text-foreground"
                    />
                  </label>
                  <span className="text-sm font-semibold text-foreground">€{cost.toFixed(2)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">Labels</p>
          <span className="text-xs text-muted-foreground">
            {form.labels.length}/{MAX_LABELS_PER_EVENT} gekozen · €0,99 voor 1, €1,69 voor 2
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Max 2 opvallende labels op je kaart — kleur inbegrepen.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {availability.map((a) => {
            const selected = form.labels.find((l) => l.type === a.type);
            const disabled = !a.available && !selected;
            return (
              <button
                key={a.type}
                type="button"
                disabled={disabled || (!selected && form.labels.length >= MAX_LABELS_PER_EVENT)}
                onClick={() => toggleLabel(a.type)}
                title={a.reason}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : disabled
                      ? "cursor-not-allowed border-border text-muted-foreground/40"
                      : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {EVENT_LABEL_TEXT_NL[a.type]}
              </button>
            );
          })}
        </div>

        {/* Kleurkeuze per geselecteerd label */}
        {form.labels.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            {form.labels.map((l) => (
              <div key={l.type} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_CLASSES[l.colorKey]}`}>
                  {EVENT_LABEL_TEXT_NL[l.type]}
                </span>
                <div className="flex gap-1">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setLabelColor(l.type, color)}
                      className={`h-5 w-5 rounded-full border-2 transition ${
                        l.colorKey === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: COLOR_HEX[color] }}
                      aria-label={color}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => toggleLabel(l.type)}
                  className="ml-auto text-muted-foreground hover:text-rose-500"
                  aria-label="Verwijder label"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-sm font-semibold text-foreground">Labelkosten: €{labelsCost.toFixed(2)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
