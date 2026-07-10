"use client";

import { Calendar, MapPin, Ticket, Megaphone, Store, CheckCircle2, Users, ExternalLink, Building2, Images, Table2 } from "lucide-react";
import {
  EVENT_TYPE_LABELS_NL, FACILITY_LABELS_NL, ACTIVITY_KEYS, FACILITY_KEYS,
  type EventType, type FacilityKey,
} from "@/lib/events/types";
import { getEventCountryName } from "@/lib/events/countries";
import {
  calculateEventBannerCost,
  bannerDaysUntil,
  calculateEventSpotlightCost,
  eventUpsellDaysUntil,
  EVENT_SPOTLIGHT_STORED_TYPE,
} from "@/lib/events/upsell-config";
import { CountryFlag } from "@/components/ui/country-flag";
import type { EventFormState } from "@/components/events/event-form-types";

function Row({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> <span className="min-w-0">{children}</span>
    </p>
  );
}

export function EventLivePreview({ form, accountType }: { form: EventFormState; accountType: string }) {
  const dateLabel = form.startDate
    ? new Date(`${form.startDate}T00:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "datum";
  const activeFacilities = [...ACTIVITY_KEYS, ...FACILITY_KEYS].filter((k) => form[k as FacilityKey] as boolean) as FacilityKey[];
  const validTickets = form.ticketTypes.filter((t) => t.name.trim());
  const validVendor = form.vendorOptions.filter((t) => t.name.trim());
  const promoDays = bannerDaysUntil(form.promoteUntil);
  const promoCost = form.promote ? calculateEventBannerCost(promoDays, accountType) : 0;
  const spotlightDays = eventUpsellDaysUntil(form.spotlightUntil, EVENT_SPOTLIGHT_STORED_TYPE);
  const spotlightCost = form.spotlight ? calculateEventSpotlightCost(spotlightDays, accountType) : 0;
  const fmtPrice = (p: string) => (Number(p || 0) === 0 ? "gratis" : `€${p}`);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Banner */}
      <div className="aspect-[3/1] w-full bg-muted">
        {form.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Calendar className="h-8 w-8" /></div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voorbeeld</p>

        {form.eventType && (
          <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {EVENT_TYPE_LABELS_NL[form.eventType as EventType]}
          </span>
        )}
        <h3 className="text-lg font-bold leading-tight text-foreground">{form.title || "Titel van je evenement"}</h3>

        {form.description && (
          <div
            className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert line-clamp-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: form.description }}
          />
        )}

        <div className="space-y-1.5 border-t border-border pt-3">
          {(form.startDate || form.startTime) && (
            <Row icon={Calendar}>
              {dateLabel} · {form.startTime}–{form.endTime}
              {form.earlyAccessTime ? ` · VT ${form.earlyAccessTime}` : ""}
            </Row>
          )}
          {(form.city || form.venueName) && (
            <Row icon={MapPin}>
              {form.venueName && `${form.venueName}, `}{form.city || "plaats"}{" "}
              <CountryFlag code={form.country} size="xs" /> {getEventCountryName(form.country, "nl")}
            </Row>
          )}
          <Row icon={Ticket}>
            {form.entryType === "FREE"
              ? "Gratis entree"
              : validTickets.length
                ? validTickets.map((t) => `${t.name} ${fmtPrice(t.price)}`).join(" · ")
                : "Betaald (nog geen tickets)"}
          </Row>
          {form.entryType === "PAID" && form.ticketSaleMode === "ONLINE" && form.registrationUrl && validTickets.length > 0 && (
            <Row icon={ExternalLink}>Ticketlink toegevoegd</Row>
          )}
          {form.entryType === "PAID" && form.ticketSaleMode === "DOOR" && (
            <Row icon={Ticket}>Tickets aan de deur</Row>
          )}
          {validVendor.length > 0 && (
            <Row icon={Store}>
              Standhouders: {validVendor.map((v) => `${v.name} ${fmtPrice(v.price)}`).join(" · ")}
            </Row>
          )}
          {form.totalTables && <Row icon={Table2}>{form.totalTables} tafels voor standhouders</Row>}
          {form.maxVisitors && <Row icon={Users}>max. {form.maxVisitors} bezoekers</Row>}
          {form.organizerName.trim() && <Row icon={Building2}>Door {form.organizerName.trim()}</Row>}
          {(form.galleryImages.length > 0 || form.videoUrl.trim().length > 0) && (
            <Row icon={Images}>
              {[
                form.galleryImages.length > 0 ? `${form.galleryImages.length} foto${form.galleryImages.length === 1 ? "" : "'s"}` : null,
                form.videoUrl.trim().length > 0 ? "video" : null,
              ].filter(Boolean).join(" · ")}
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

        {(form.promote || form.spotlight) && (
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            {form.promote && (
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  Uitgelichte banner{form.promoteUntil ? ` tot ${new Date(form.promoteUntil).toLocaleDateString("nl-NL")}` : ""} — €{promoCost.toFixed(2)}
                </span>
              </div>
            )}
            {form.spotlight && (
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-indigo-500" />
                <span className="font-medium text-foreground">
                  Homepage-spotlight{form.spotlightUntil ? ` tot ${new Date(form.spotlightUntil).toLocaleDateString("nl-NL")}` : ""} — €{spotlightCost.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
