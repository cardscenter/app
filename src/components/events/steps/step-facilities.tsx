"use client";

import { Gamepad2, Repeat, Tag, Car, Coffee, Toilet, Wifi, CreditCard, Accessibility, Shirt, Baby } from "lucide-react";
import { ACTIVITY_KEYS, FACILITY_KEYS, FACILITY_LABELS_NL, type FacilityKey } from "@/lib/events/types";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const ICONS: Record<FacilityKey, React.ComponentType<{ className?: string }>> = {
  canPlay: Gamepad2,
  canTrade: Repeat,
  canSell: Tag,
  hasParking: Car,
  hasFood: Coffee,
  hasToilets: Toilet,
  hasWifi: Wifi,
  cardPayment: CreditCard,
  wheelchairAccessible: Accessibility,
  hasCloakroom: Shirt,
  childFriendly: Baby,
};

function Chip({ k, form, set }: { k: FacilityKey; form: EventFormState; set: EventFieldSetter }) {
  const Icon = ICONS[k];
  const checked = form[k] as boolean;
  return (
    <button
      type="button"
      onClick={() => set(k, !checked)}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" /> {FACILITY_LABELS_NL[k]}
    </button>
  );
}

export function StepFacilities({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Faciliteiten</h2>
      <p className="text-sm text-muted-foreground">Klik aan wat van toepassing is — dit helpt bezoekers kiezen.</p>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Wat kan er?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ACTIVITY_KEYS.map((k) => <Chip key={k} k={k} form={form} set={set} />)}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Voorzieningen</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITY_KEYS.map((k) => <Chip key={k} k={k} form={form} set={set} />)}
        </div>
      </div>

      <div className="sm:max-w-xs">
        <label className="block text-sm font-medium text-foreground" htmlFor="evt-max">Max. aantal bezoekers</label>
        <input
          id="evt-max"
          type="number" min="1"
          value={form.maxVisitors}
          onChange={(e) => set("maxVisitors", e.target.value)}
          placeholder="Onbeperkt"
          className={`mt-1 ${inputClass}`}
        />
      </div>
    </section>
  );
}
