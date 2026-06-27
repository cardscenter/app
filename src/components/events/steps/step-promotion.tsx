"use client";

import { Megaphone, Check, ImageOff, Home, Star } from "lucide-react";
import {
  calculateEventBannerCost,
  calculateEventSpotlightCost,
  bannerDaysUntil,
  eventUpsellDaysUntil,
  EVENT_BANNER_DAILY_COST,
  EVENT_SPOTLIGHT_DAILY_COST,
  EVENT_SPOTLIGHT_STORED_TYPE,
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

  const bannerDays = bannerDaysUntil(form.promoteUntil);
  const bannerCost = calculateEventBannerCost(bannerDays, accountType);

  const spotlightDays = eventUpsellDaysUntil(form.spotlightUntil, EVENT_SPOTLIGHT_STORED_TYPE);
  const spotlightCost = calculateEventSpotlightCost(spotlightDays, accountType);

  const total = (form.promote ? bannerCost : 0) + (form.spotlight ? spotlightCost : 0);

  function toggleBanner() {
    if (!hasBanner) return;
    const next = !form.promote;
    set("promote", next);
    if (next && !form.promoteUntil) set("promoteUntil", form.startDate || todayStr);
  }
  function toggleSpotlight() {
    if (!hasBanner) return;
    const next = !form.spotlight;
    set("spotlight", next);
    if (next && !form.spotlightUntil) set("spotlightUntil", form.startDate || todayStr);
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Megaphone className="h-5 w-5" /> Promotie
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optioneel. Zonder promotie verschijnt je evenement gewoon in de lijst. Met promotie
          val je extra op — kies één of beide opties.
        </p>
      </div>

      {!hasBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <ImageOff className="h-4 w-4 shrink-0" /> Upload eerst een banner-afbeelding (stap Foto) om promotie te kunnen kiezen.
        </div>
      )}

      {/* Optie 1 — uitgelichte banner op de evenementenpagina */}
      <div>
        <button
          type="button"
          onClick={toggleBanner}
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
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Star className="h-4 w-4 text-amber-500" /> Uitgelichte banner
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Je banner verschijnt groot in de &ldquo;Uitgelicht&rdquo;-rij bovenaan de evenementenpagina. €{EVENT_BANNER_DAILY_COST.toFixed(2)} per dag.
            </span>
          </span>
        </button>

        {hasBanner && form.promote && (
          <div className="mt-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm text-muted-foreground" htmlFor="promo-until">Uitgelicht tot en met</label>
                <input
                  id="promo-until"
                  type="date"
                  min={todayStr}
                  max={form.startDate || undefined}
                  value={form.promoteUntil}
                  onChange={(e) => set("promoteUntil", e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground"
                />
                {form.startDate && <p className="mt-1 text-xs text-muted-foreground">Maximaal tot de evenementdatum ({new Date(`${form.startDate}T00:00:00`).toLocaleDateString("nl-NL")}).</p>}
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">{bannerDays} dag{bannerDays === 1 ? "" : "en"} × €{EVENT_BANNER_DAILY_COST.toFixed(2)}</p>
                <p className="text-lg font-bold text-foreground">€{bannerCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optie 2 — homepage-spotlight op de hoofd-homepage van de site */}
      <div>
        <button
          type="button"
          onClick={toggleSpotlight}
          disabled={!hasBanner}
          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
            !hasBanner
              ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
              : form.spotlight
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted"
          }`}
        >
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${form.spotlight ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {form.spotlight && <Check className="h-3.5 w-3.5" />}
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Home className="h-4 w-4 text-indigo-500" /> Op de hoofd-homepage
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Je evenement verschijnt in een uitgelichte rij op de homepage van Cards Center — waar de meeste bezoekers komen. €{EVENT_SPOTLIGHT_DAILY_COST.toFixed(2)} per dag.
            </span>
          </span>
        </button>

        {hasBanner && form.spotlight && (
          <div className="mt-2 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm text-muted-foreground" htmlFor="spotlight-until">Op de homepage tot en met</label>
                <input
                  id="spotlight-until"
                  type="date"
                  min={todayStr}
                  max={form.startDate || undefined}
                  value={form.spotlightUntil}
                  onChange={(e) => set("spotlightUntil", e.target.value)}
                  className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground"
                />
                {form.startDate && <p className="mt-1 text-xs text-muted-foreground">Maximaal tot de evenementdatum ({new Date(`${form.startDate}T00:00:00`).toLocaleDateString("nl-NL")}).</p>}
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">{spotlightDays} dag{spotlightDays === 1 ? "" : "en"} × €{EVENT_SPOTLIGHT_DAILY_COST.toFixed(2)}</p>
                <p className="text-lg font-bold text-foreground">€{spotlightCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium text-foreground">Totaal promotie</span>
          <span className="text-lg font-bold text-foreground">€{total.toFixed(2)}</span>
        </div>
      )}
      {total > 0 && (
        <p className="text-xs text-muted-foreground">Wordt afgeschreven van je saldo bij publiceren.</p>
      )}
    </section>
  );
}
