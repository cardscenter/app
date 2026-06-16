"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createEvent } from "@/actions/event";
import {
  INITIAL_EVENT_FORM,
  type EventFormState,
  type EventFieldSetter,
} from "@/components/events/event-form-types";
import { EventFormProgress, type EventStepKey } from "@/components/events/event-form-progress";
import { EventFormSummary } from "@/components/events/event-form-summary";
import { StepType } from "@/components/events/steps/step-type";
import { StepDetails } from "@/components/events/steps/step-details";
import { StepLocation } from "@/components/events/steps/step-location";
import { StepExtras } from "@/components/events/steps/step-extras";
import { StepPhoto } from "@/components/events/steps/step-photo";
import { StepPromotion } from "@/components/events/steps/step-promotion";

interface Requirement {
  section: EventStepKey;
  label: string;
}

interface DuplicateMatch {
  id: string;
  title: string;
  city: string;
  startTime: string;
}

export function MultiStepEventForm({ accountType }: { accountType: string }) {
  const router = useRouter();
  const [form, setForm] = useState<EventFormState>(INITIAL_EVENT_FORM);
  const [isPending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const set: EventFieldSetter = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const requirements = useMemo<Requirement[]>(() => {
    const reqs: Requirement[] = [];
    if (!form.eventType) reqs.push({ section: "type", label: "Type evenement" });
    if (form.title.trim().length < 3) reqs.push({ section: "details", label: "Titel" });
    if (!form.startDate) reqs.push({ section: "details", label: "Datum" });
    if (!form.startTime) reqs.push({ section: "details", label: "Begintijd" });
    if (!form.endTime) reqs.push({ section: "details", label: "Eindtijd" });
    if (!form.venueName.trim()) reqs.push({ section: "location", label: "Naam locatie" });
    if (!form.street.trim()) reqs.push({ section: "location", label: "Straat" });
    if (!form.houseNumber.trim()) reqs.push({ section: "location", label: "Huisnummer" });
    if (!form.postalCode.trim()) reqs.push({ section: "location", label: "Postcode" });
    if (!form.city.trim()) reqs.push({ section: "location", label: "Plaats" });
    if (!form.country) reqs.push({ section: "location", label: "Land" });
    if (form.entryType === "PAID" && (!form.entryPrice || Number(form.entryPrice) <= 0)) {
      reqs.push({ section: "extras", label: "Entreeprijs" });
    }
    if (form.registrationRequired && !form.registrationUrl.trim()) {
      reqs.push({ section: "extras", label: "Aanmeldlink" });
    }
    return reqs;
  }, [form]);

  const completedSteps = useMemo(() => {
    const done = new Set<EventStepKey>();
    if (form.eventType) done.add("type");
    if (form.title.trim().length >= 3 && form.startDate && form.startTime && form.endTime) done.add("details");
    if (form.venueName && form.street && form.houseNumber && form.postalCode && form.city && form.country) {
      done.add("location");
    }
    if (form.entryType === "FREE" || (form.entryPrice && Number(form.entryPrice) > 0)) {
      if (!form.registrationRequired || form.registrationUrl) done.add("extras");
    }
    if (form.coverImage) done.add("photo");
    if (form.upsells.length > 0 || form.labels.length > 0) done.add("promotion");
    return done;
  }, [form]);

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
    fd.set("startDate", form.startDate);
    fd.set("startTime", form.startTime);
    if (form.endDate) fd.set("endDate", form.endDate);
    fd.set("endTime", form.endTime);
    fd.set("entryType", form.entryType);
    if (form.entryType === "PAID") {
      fd.set("entryPrice", form.entryPrice);
      fd.set("entryCurrency", form.entryCurrency);
    }
    fd.set("canPlay", form.canPlay ? "1" : "0");
    fd.set("canTrade", form.canTrade ? "1" : "0");
    fd.set("canSell", form.canSell ? "1" : "0");
    fd.set("hasParking", form.hasParking ? "1" : "0");
    fd.set("hasFood", form.hasFood ? "1" : "0");
    if (form.maxVisitors) fd.set("maxVisitors", form.maxVisitors);
    fd.set("registrationRequired", form.registrationRequired ? "1" : "0");
    if (form.registrationUrl) fd.set("registrationUrl", form.registrationUrl);
    if (form.coverImage) fd.set("coverImage", form.coverImage);
    if (form.eventType === "OP_TOERNOOI") {
      if (form.tournamentFormat) fd.set("tournamentFormat", form.tournamentFormat);
      if (form.prizePool) fd.set("prizePool", form.prizePool);
      fd.set("isSanctioned", form.isSanctioned ? "1" : "0");
    }
    fd.set("labels", JSON.stringify(form.labels));
    fd.set("upsells", JSON.stringify(form.upsells));
    if (confirm) fd.set("confirmDuplicate", "1");
    return fd;
  }

  function submit(confirm: boolean) {
    if (requirements.length > 0) {
      const first = requirements[0];
      document.querySelector(`[data-section="${first.section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.error(`Vul eerst in: ${first.label}`);
      return;
    }
    startTransition(async () => {
      const res = await createEvent(buildFormData(confirm));
      if (res?.error) {
        toast.error(res.error);
        return;
      }
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
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
      <div className="space-y-8">
        <EventFormProgress completed={completedSteps} />

        {duplicates && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Mogelijk al bestaand evenement
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {duplicates.map((d) => (
                <li key={d.id}>
                  • {d.title} — {d.city} ({new Date(d.startTime).toLocaleDateString("nl-NL")})
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Weet je zeker dat dit een ander evenement is? Dan kun je toch publiceren.
            </p>
          </div>
        )}

        <StepType form={form} set={set} />
        <StepDetails form={form} set={set} />
        <StepLocation form={form} set={set} />
        <StepExtras form={form} set={set} />
        <StepPhoto form={form} set={set} />
        <StepPromotion form={form} set={set} accountType={accountType} />
      </div>

      <div className="mt-8 lg:mt-0">
        <div className="hidden lg:block">
          <EventFormSummary form={form} accountType={accountType} />
        </div>
      </div>

      {/* Sticky onderbalk */}
      <div className="sticky bottom-4 z-10 col-span-full mt-6">
        <div className="rounded-xl border border-border bg-card/95 p-3 shadow-card-hover backdrop-blur">
          {requirements.length > 0 ? (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <span className="text-sm text-muted-foreground">Nog invullen:</span>
                {requirements.slice(0, 5).map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => document.querySelector(`[data-section="${r.section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {r.label}
                  </button>
                ))}
                {requirements.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{requirements.length - 5}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => submit(confirmDuplicate)}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmDuplicate ? "Toch publiceren" : "Evenement publiceren"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
