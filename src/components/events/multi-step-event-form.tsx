"use client";

import { useState, useTransition } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Check, ChevronLeft, ChevronRight, MailWarning } from "lucide-react";
import { createEvent } from "@/actions/event";
import { INITIAL_EVENT_FORM, type EventFormState, type EventFieldSetter } from "@/components/events/event-form-types";
import { bannerDaysUntil, eventUpsellDaysUntil, EVENT_SPOTLIGHT_STORED_TYPE } from "@/lib/events/upsell-config";
import { EventLivePreview } from "@/components/events/event-live-preview";
import { StepType } from "@/components/events/steps/step-type";
import { StepDetails } from "@/components/events/steps/step-details";
import { StepLocation } from "@/components/events/steps/step-location";
import { StepTickets } from "@/components/events/steps/step-tickets";
import { StepFacilities } from "@/components/events/steps/step-facilities";
import { StepPhoto } from "@/components/events/steps/step-photo";
import { StepPromotion } from "@/components/events/steps/step-promotion";
import { StepReview } from "@/components/events/steps/step-review";

interface DuplicateMatch {
  id: string;
  title: string;
  city: string;
  startTime: string;
}

const STEP_LABELS = ["Type", "Details", "Locatie", "Tickets & stands", "Faciliteiten", "Foto", "Promotie", "Controleren"];

function validateStep(step: number, form: EventFormState): string | null {
  switch (step) {
    case 0:
      return form.eventType ? null : "Kies een type evenement";
    case 1:
      if (form.title.trim().length < 3) return "Vul een titel in (min. 3 tekens)";
      if (!form.startDate) return "Kies een datum";
      if (!form.startTime || !form.endTime) return "Vul begin- en eindtijd in";
      return null;
    case 2:
      if (!form.venueName.trim()) return "Vul de naam van de locatie in";
      if (!form.street.trim()) return "Vul de straat in";
      if (!form.houseNumber.trim()) return "Vul het huisnummer in";
      if (!form.postalCode.trim()) return "Vul de postcode in";
      if (!form.city.trim()) return "Vul de plaats in";
      if (!form.country) return "Kies een land";
      return null;
    case 3:
      if (form.entryType === "PAID") {
        if (!form.ticketTypes.some((t) => t.name.trim())) return "Voeg minstens één ticket-soort toe (of kies Gratis)";
        if (form.ticketSaleMode === "ONLINE" && !form.registrationUrl.trim()) return "Vul de link in waar bezoekers tickets kunnen kopen (of kies 'Alleen aan de deur')";
      }
      return null;
    case 6:
      if ((form.promote || form.spotlight) && !form.coverImage) return "Upload eerst een banner-afbeelding voor de promotie";
      if (form.promote && !form.promoteUntil) return "Kies tot welke datum je evenement uitgelicht moet zijn";
      if (form.spotlight && !form.spotlightUntil) return "Kies tot welke datum je evenement op de homepage moet staan";
      return null;
    default:
      return null;
  }
}

export function MultiStepEventForm({ accountType, emailVerified }: { accountType: string; emailVerified: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<EventFormState>(INITIAL_EVENT_FORM);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const set: EventFieldSetter = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const isLast = step === STEP_LABELS.length - 1;

  function goNext() {
    const err = validateStep(step, form);
    if (err) { toast.error(err); return; }
    const next = Math.min(step + 1, STEP_LABELS.length - 1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goPrev() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function jumpTo(target: number) {
    if (target <= maxReached) { setStep(target); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  function buildFormData(confirm: boolean): FormData {
    const fd = new FormData();
    fd.set("title", form.title);
    fd.set("description", form.description);
    fd.set("eventType", form.eventType);
    fd.set("venueName", form.venueName);
    fd.set("street", form.street);
    fd.set("houseNumber", form.houseNumber);
    fd.set("postalCode", form.postalCode);
    fd.set("city", form.city);
    fd.set("country", form.country);
    if (form.organizerName.trim()) fd.set("organizerName", form.organizerName.trim());
    if (form.organizerWebsite.trim()) fd.set("organizerWebsite", form.organizerWebsite.trim());
    fd.set("startDate", form.startDate);
    fd.set("startTime", form.startTime);
    if (form.endDate) fd.set("endDate", form.endDate);
    fd.set("endTime", form.endTime);

    fd.set("entryType", form.entryType);
    if (form.entryType === "PAID") {
      const tickets = form.ticketTypes
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          price: Number(t.price) || 0,
          description: t.description.trim() || undefined,
          serviceFee: Number(t.serviceFee) > 0 ? Number(t.serviceFee) : undefined,
        }));
      fd.set("ticketTypes", JSON.stringify(tickets));
      fd.set("ticketSaleMode", form.ticketSaleMode);
      if (form.ticketSaleMode === "ONLINE" && form.registrationUrl) fd.set("registrationUrl", form.registrationUrl);
    }

    const vendor = form.vendorOptions
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        price: Number(t.price) || 0,
        description: t.description.trim() || undefined,
      }));
    if (vendor.length) fd.set("vendorOptions", JSON.stringify(vendor));
    if (form.vendorInfo) fd.set("vendorInfo", form.vendorInfo);

    for (const k of ["canPlay", "canTrade", "canSell", "hasParking", "hasFood", "hasToilets", "hasWifi", "cardPayment", "wheelchairAccessible", "hasCloakroom", "childFriendly"] as const) {
      fd.set(k, form[k] ? "1" : "0");
    }
    if (form.maxVisitors) fd.set("maxVisitors", form.maxVisitors);
    if (form.totalTables) fd.set("totalTables", form.totalTables);
    if (form.coverImage) fd.set("coverImage", form.coverImage);
    if (form.flyerImage) fd.set("flyerImage", form.flyerImage);
    if (form.galleryImages.length) fd.set("galleryImages", JSON.stringify(form.galleryImages));
    if (form.videoUrl.trim()) fd.set("videoUrl", form.videoUrl.trim());

    if (form.eventType === "OP_TOERNOOI") {
      if (form.tournamentFormat) fd.set("tournamentFormat", form.tournamentFormat);
      if (form.prizePool) fd.set("prizePool", form.prizePool);
      fd.set("isSanctioned", form.isSanctioned ? "1" : "0");
    }

    fd.set("promote", form.promote ? "1" : "0");
    if (form.promote) fd.set("promoteDays", String(bannerDaysUntil(form.promoteUntil)));
    fd.set("spotlight", form.spotlight ? "1" : "0");
    if (form.spotlight) fd.set("spotlightDays", String(eventUpsellDaysUntil(form.spotlightUntil, EVENT_SPOTLIGHT_STORED_TYPE)));
    if (confirm) fd.set("confirmDuplicate", "1");
    return fd;
  }

  function publish(confirm: boolean) {
    for (let s = 0; s < STEP_LABELS.length; s++) {
      const err = validateStep(s, form);
      if (err) { setStep(s); toast.error(err); return; }
    }
    startTransition(async () => {
      const res = await createEvent(buildFormData(confirm));
      if (res?.error) { toast.error(res.error); return; }
      if (res?.duplicateWarning) {
        setDuplicates(res.duplicateWarning);
        setConfirmDuplicate(true);
        toast.warning("Er bestaat mogelijk al een vergelijkbaar evenement");
        return;
      }
      if (res?.success) {
        if (res.status === "LIVE") {
          toast.success("Evenement gepubliceerd!");
          router.push(`/evenementen/${res.eventId}`);
        } else {
          toast.success("Evenement ingediend — het wordt beoordeeld voordat het zichtbaar wordt.");
          router.push("/dashboard/evenementen");
        }
      }
    });
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      {/* Linkerkolom: stepper + actieve stap + navigatie */}
      <div>
        {!emailVerified && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <MailWarning className="h-4 w-4 shrink-0" />
            <span>Bevestig eerst je e-mailadres — anders kun je dit evenement niet publiceren.</span>
            <Link href="/dashboard" className="font-semibold underline underline-offset-2">Naar dashboard</Link>
          </div>
        )}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">Stap {step + 1} van {STEP_LABELS.length}</span>
            <span className="text-muted-foreground">{STEP_LABELS[step]}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEP_LABELS.map((label, i) => {
              const done = i <= maxReached && i !== step;
              const current = i === step;
              const reachable = i <= maxReached;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => jumpTo(i)}
                  disabled={!reachable}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : reachable
                          ? "bg-muted text-muted-foreground hover:bg-muted/70"
                          : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {duplicates && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Mogelijk al bestaand evenement
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {duplicates.map((d) => (
                <li key={d.id}>• {d.title} — {d.city} ({new Date(d.startTime).toLocaleDateString("nl-NL")})</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Is dit een ander evenement? Dan kun je hieronder toch publiceren.</p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          {step === 0 && <StepType form={form} set={set} />}
          {step === 1 && <StepDetails form={form} set={set} />}
          {step === 2 && <StepLocation form={form} set={set} />}
          {step === 3 && <StepTickets form={form} set={set} />}
          {step === 4 && <StepFacilities form={form} set={set} />}
          {step === 5 && <StepPhoto form={form} set={set} />}
          {step === 6 && <StepPromotion form={form} set={set} accountType={accountType} />}
          {step === 7 && <StepReview form={form} accountType={accountType} />}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={goPrev} disabled={step === 0 || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Vorige
          </button>
          {isLast ? (
            <button type="button" onClick={() => publish(confirmDuplicate)} disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmDuplicate ? "Toch publiceren" : "Evenement publiceren"}
            </button>
          ) : (
            <button type="button" onClick={goNext} disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
              Volgende <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rechterkolom: sticky live-preview (desktop) */}
      <div className="hidden lg:block">
        <div className="sticky top-20">
          <EventLivePreview form={form} accountType={accountType} />
        </div>
      </div>
    </div>
  );
}
