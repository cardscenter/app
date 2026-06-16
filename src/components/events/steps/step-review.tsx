"use client";

import {
  Calendar, MapPin, Ticket, Megaphone, Store, Baby, CheckCircle2,
} from "lucide-react";
import { EVENT_TYPE_LABELS_NL, FACILITY_LABELS_NL, ACTIVITY_KEYS, FACILITY_KEYS, type EventType, type FacilityKey } from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import { timezoneForCountry } from "@/lib/events/timezones";
import { calculateEventBannerCost, EVENT_BANNER_MIN_DAYS, EVENT_BANNER_MAX_DAYS } from "@/lib/events/upsell-config";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventFormState } from "@/components/events/event-form-types";

function Row({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> <span>{children}</span>
    </p>
  );
}

export function StepReview({ form, accountType }: { form: EventFormState; accountType: string }) {
  const tz = timezoneForCountry(form.country);
  const activeFacilities = [...ACTIVITY_KEYS, ...FACILITY_KEYS].filter((k) => form[k as FacilityKey] as boolean) as FacilityKey[];
  const promoDays = Math.max(EVENT_BANNER_MIN_DAYS, Math.min(form.promoteDays, EVENT_BANNER_MAX_DAYS));
  const promoCost = form.promote ? calculateEventBannerCost(promoDays, accountType) : 0;

  const entryLabel = (() => {
    if (form.entryType === "FREE") return "Gratis entree";
    if (form.entryPriceMode === "TIERS") {
      const valid = form.ticketTypes.filter((t) => t.name.trim());
      return valid.length ? valid.map((t) => `${t.name} ${form.entryCurrency} ${t.price || "?"}`).join(" · ") : "Meerdere tickets";
    }
    const prefix = form.entryPriceMode === "FROM" ? "vanaf " : "";
    return `${prefix}${form.entryCurrency} ${form.entryPrice || "?"}`;
  })();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Controleren & publiceren</h2>
      <p className="text-sm text-muted-foreground">
        Controleer de gegevens. Na publiceren wordt je evenement beoordeeld voordat het zichtbaar wordt
        (tenzij je een vertrouwde organisator bent).
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Banner */}
        <div className="aspect-[3/1] w-full bg-muted">
          {form.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="space-y-3 p-4">
          {form.eventType && (
            <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {EVENT_TYPE_LABELS_NL[form.eventType as EventType]}
            </span>
          )}
          <h3 className="text-xl font-bold text-foreground">{form.title || "—"}</h3>

          {form.description && (
            <div
              className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: form.description }}
            />
          )}

          <div className="space-y-1.5 border-t border-border pt-3">
            <Row icon={Calendar}>
              {form.startDate || "—"} · {form.startTime}–{form.endTime} ({tz})
            </Row>
            <Row icon={MapPin}>
              {form.venueName}, {form.street} {form.houseNumber}, {form.postalCode} {form.city}{" "}
              <CountryFlag code={form.country} size="sm" /> {getEventCountryName(form.country, "nl")}
            </Row>
            <Row icon={Ticket}>{entryLabel}</Row>
            {form.childrenFreeUntilAge && (
              <Row icon={Baby}>Kinderen t/m {form.childrenFreeUntilAge} jaar gratis</Row>
            )}
            {(form.vendorTablePrice || form.vendorChairPrice) && (
              <Row icon={Store}>
                Standhouders:
                {form.vendorTablePrice && ` tafel ${form.entryCurrency} ${form.vendorTablePrice}`}
                {form.vendorChairPrice && ` · stoel ${form.entryCurrency} ${form.vendorChairPrice}`}
                {form.vendorPowerAvailable && " · stroom beschikbaar"}
              </Row>
            )}
          </div>

          {activeFacilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              {activeFacilities.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {FACILITY_LABELS_NL[k]}
                </span>
              ))}
            </div>
          )}

          {form.promote && (
            <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">Uitgelichte banner ({promoDays} dagen) — €{promoCost.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
