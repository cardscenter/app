"use client";

import { ImageUploader } from "@/components/ui/image-uploader";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

export function StepPhoto({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  return (
    <section data-section="photo" className="scroll-mt-32 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Foto / flyer</h2>
      <p className="text-sm text-muted-foreground">
        Eén afbeelding — getoond als thumbnail in de kalender en groot bij de details.
        Een aantrekkelijke flyer trekt meer bezoekers.
      </p>
      <ImageUploader
        images={form.coverImage ? [form.coverImage] : []}
        onChange={(imgs) => set("coverImage", imgs[imgs.length - 1] ?? "")}
        maxImages={1}
        context="event"
      />
    </section>
  );
}
