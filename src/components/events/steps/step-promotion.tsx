"use client";

import { Megaphone, Check, ImageOff } from "lucide-react";
import {
  calculateEventBannerCost,
  bannerDaysUntil,
  EVENT_BANNER_DAILY_COST,
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
  const hasBanner = !!form.coverImage;
  const todayStr = new Date().toISOString().slice(0, 10);
  const days = bannerDaysUntil(form.promoteUntil);
  const cost = calculateEventBannerCost(days, accountType);

  function toggle() {
    if (!hasBanner) return;
    const next = !form.promote;
    set("promote", next);
    if (next && !form.promoteUntil) set("promoteUntil", form.startDate || todayStr);
  }

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

      {!hasBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <ImageOff className="h-4 w-4 shrink-0" /> Upload eerst een banner-afbeelding (stap Foto) om promotie te kunnen kiezen.
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={!hasBanner}
        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
          !hasBanner
            ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
            : form.promote
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-card hover:bg-muted"
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

      {hasBanner && form.promote && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm text-muted-foreground" htmlFor="promo-until">Uitgelicht tot en met</label>
              <input
                id="promo-until"
                type="date"
                min={todayStr}
                value={form.promoteUntil}
                onChange={(e) => set("promoteUntil", e.target.value)}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground"
              />
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">{days} dag{days === 1 ? "" : "en"} × €{EVENT_BANNER_DAILY_COST.toFixed(2)}</p>
              <p className="text-lg font-bold text-foreground">€{cost.toFixed(2)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Wordt afgeschreven van je saldo bij publiceren.</p>
        </div>
      )}
    </section>
  );
}
