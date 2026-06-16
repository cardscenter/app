"use client";

import Image from "next/image";
import { Calendar, MapPin } from "lucide-react";
import { EVENT_TYPE_LABELS_NL, EVENT_TYPE_PILL_CLASSES, type EventType } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { CountryFlag } from "@/components/ui/country-flag";
import { EVENT_LABEL_TEXT_NL, COLOR_CLASSES } from "@/lib/events/labels";
import { calculateEventUpsellCost } from "@/lib/events/upsell-config";
import { calculateEventLabelCost } from "@/lib/events/labels";
import type { EventFormState } from "@/components/events/event-form-types";

export function EventFormSummary({ form, accountType }: { form: EventFormState; accountType: string }) {
  const upsellCost = form.upsells.reduce(
    (s, u) => s + calculateEventUpsellCost(u.type, u.days, accountType),
    0,
  );
  const labelCost = calculateEventLabelCost(form.labels.length);
  const totalCost = Math.round((upsellCost + labelCost) * 100) / 100;

  return (
    <div className="lg:sticky lg:top-20">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="relative aspect-[16/10] w-full bg-muted">
          {form.coverImage ? (
            <Image src={form.coverImage} alt="" fill className="object-cover" sizes="360px" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Calendar className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          {form.eventType && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_TYPE_PILL_CLASSES[form.eventType as EventType]}`}>
              {EVENT_TYPE_LABELS_NL[form.eventType as EventType]}
            </span>
          )}
          <h3 className="font-bold text-foreground">{form.title || "Titel van je evenement"}</h3>

          {(form.startDate || form.startTime) && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {form.startDate || "datum"} · {form.startTime}–{form.endTime}
            </p>
          )}

          {(form.city || form.country) && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {form.city || "plaats"}
              <CountryFlag code={form.country} size="sm" />
              {getEventCountryName(form.country, "nl")}
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            Entree: {form.entryType === "FREE" ? "Gratis" : `${form.entryCurrency} ${form.entryPrice || "—"}`}
          </p>

          {form.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {form.labels.map((l) => (
                <span key={l.type} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_CLASSES[l.colorKey]}`}>
                  {EVENT_LABEL_TEXT_NL[l.type]}
                </span>
              ))}
            </div>
          )}

          {totalCost > 0 && (
            <div className="border-t border-border pt-2 text-sm">
              <span className="font-medium text-foreground">Promotiekosten: €{totalCost.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
