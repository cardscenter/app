"use client";

import { Megaphone, Check } from "lucide-react";
import {
  calculateEventBannerCost,
  EVENT_BANNER_MIN_DAYS,
  EVENT_BANNER_MAX_DAYS,
} from "@/lib/events/upsell-config";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

export function StepPromotion({
  form,
  set,
  accountType,
}: {
  form: EventFormState;
  set: EventFieldSetter;
  accountType: string;
}) {
  const days = Math.max(EVENT_BANNER_MIN_DAYS, Math.min(form.promoteDays, EVENT_BANNER_MAX_DAYS));
  const cost = calculateEventBannerCost(days, accountType);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Megaphone className="h-5 w-5" /> Promotie
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optioneel. Zonder promotie verschijnt je evenement gewoon in de lijst. Met een
          <strong> uitgelichte banner</strong> sta je groot bovenaan de evenementenpagina.
        </p>
      </div>

      <button
        type="button"
        onClick={() => set("promote", !form.promote)}
        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
          form.promote ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-muted"
        }`}
      >
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${form.promote ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
          {form.promote && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="flex-1">
          <span className="font-semibold text-foreground">Uitgelichte banner</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Je banner verschijnt groot in de &ldquo;Uitgelicht&rdquo;-rij bovenaan de evenementenpagina.
          </span>
        </span>
      </button>

      {form.promote && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground">
              Aantal dagen uitgelicht:
              <input
                type="number"
                min={EVENT_BANNER_MIN_DAYS}
                max={EVENT_BANNER_MAX_DAYS}
                value={form.promoteDays}
                onChange={(e) => set("promoteDays", Math.max(EVENT_BANNER_MIN_DAYS, Math.min(EVENT_BANNER_MAX_DAYS, Number(e.target.value) || EVENT_BANNER_MIN_DAYS)))}
                className="ml-2 w-20 rounded-lg border border-border bg-background px-2 py-1 text-base text-foreground"
              />
            </label>
            <span className="text-lg font-bold text-foreground">€{cost.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Wordt afgeschreven van je saldo bij publiceren. Tip: zorg dat je banner-afbeelding een
            mooie liggende verhouding (3:1) heeft.
          </p>
        </div>
      )}
    </section>
  );
}
