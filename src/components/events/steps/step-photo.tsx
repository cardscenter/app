"use client";

import { ImageUploader } from "@/components/ui/image-uploader";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

export function StepPhoto({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Afbeelding / banner</h2>
      <p className="text-sm text-muted-foreground">
        Eén brede banner — getoond in de kalender, in de lijst en groot op de detailpagina.
        Gebruik een <strong>liggende</strong> afbeelding van ongeveer <strong>1200 × 400 px</strong> (verhouding 3:1)
        voor het beste resultaat.
      </p>

      {/* Voorbeeld in de juiste verhouding */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="aspect-[3/1] w-full bg-muted">
          {form.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      </div>

      <ImageUploader
        images={form.coverImage ? [form.coverImage] : []}
        onChange={(imgs) => set("coverImage", imgs[imgs.length - 1] ?? "")}
        maxImages={1}
        context="event"
      />
    </section>
  );
}
