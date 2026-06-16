"use client";

import { useState } from "react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

export function StepPhoto({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("context", "event");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { urls?: string[]; errors?: string[] };
      if (data.urls?.length) set("coverImage", data.urls[0]);
      data.errors?.forEach((e) => toast.error(e));
    } catch {
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Afbeelding / banner</h2>
      <p className="text-sm text-muted-foreground">
        Eén brede banner — getoond in de kalender, in de lijst en groot op de detailpagina.
        Gebruik een <strong>liggende</strong> afbeelding van ongeveer <strong>1200 × 400 px</strong> (verhouding 3:1).
      </p>

      {form.coverImage ? (
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => set("coverImage", "")}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
            aria-label="Verwijder banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
          className={`flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition hover:border-primary/50 hover:bg-muted/30 ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files)} />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              <span className="mt-2 text-sm font-medium text-muted-foreground">Banner uploaden</span>
              <span className="text-xs text-muted-foreground/70">klik of sleep een afbeelding hierheen</span>
            </>
          )}
        </label>
      )}
    </section>
  );
}
