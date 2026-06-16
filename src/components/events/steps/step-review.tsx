"use client";

import { CheckCircle2 } from "lucide-react";
import { EventLivePreview } from "@/components/events/event-live-preview";
import type { EventFormState } from "@/components/events/event-form-types";

export function StepReview({ form, accountType }: { form: EventFormState; accountType: string }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Controleren & publiceren</h2>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        Controleer hieronder of alles klopt. Na publiceren wordt je evenement beoordeeld voordat
        het zichtbaar wordt (tenzij je een vertrouwde organisator bent).
      </p>

      {/* Op grote schermen staat de preview al sticky rechts; hier voor mobiel. */}
      <div className="lg:hidden">
        <EventLivePreview form={form} accountType={accountType} />
      </div>
    </section>
  );
}
