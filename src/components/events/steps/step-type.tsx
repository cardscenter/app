"use client";

import { Store, Users, Trophy, Sparkles, Coffee } from "lucide-react";
import { EVENT_TYPES, EVENT_TYPE_LABELS_NL, type EventType } from "@/lib/events/types";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const TYPE_META: Record<EventType, { icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  BEURS: { icon: Store, desc: "Verzamelbeurs met meerdere verkopers" },
  TRADE_NIGHT: { icon: Users, desc: "Dag of avond om kaarten te ruilen" },
  OP_TOERNOOI: { icon: Trophy, desc: "Georganiseerd toernooi (TCG+)" },
  RELEASE_EVENT: { icon: Sparkles, desc: "Pre-release of release-feest" },
  MEETUP: { icon: Coffee, desc: "Informele bijeenkomst" },
};

export function StepType({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section data-section="type" className="scroll-mt-32">
      <h2 className="text-lg font-semibold text-foreground">Wat voor evenement is dit?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Beurzen verschijnen standaard op de beurzen-kalender; de rest onder &ldquo;Events&rdquo;.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EVENT_TYPES.map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const selected = form.eventType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => set("eventType", type)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-semibold text-foreground">{EVENT_TYPE_LABELS_NL[type]}</span>
              <span className="text-xs text-muted-foreground">{meta.desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
