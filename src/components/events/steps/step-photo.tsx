"use client";

import { useState } from "react";
import { ImageIcon, X, Loader2, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { isSupportedVideoUrl } from "@/lib/events/video";
import type { EventFormState, EventFieldSetter } from "@/components/events/event-form-types";

const MAX_GALLERY = 8;

export function StepPhoto({ form, set }: { form: EventFormState; set: EventFieldSetter }) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  async function uploadFiles(files: FileList | null): Promise<string[]> {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return [];
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    fd.append("context", "event");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = (await res.json()) as { urls?: string[]; errors?: string[] };
    data.errors?.forEach((e) => toast.error(e));
    return data.urls ?? [];
  }

  async function uploadCover(files: FileList | null) {
    if (!files?.length) return;
    setUploadingCover(true);
    try {
      const urls = await uploadFiles(files);
      if (urls.length) set("coverImage", urls[0]);
    } catch {
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function uploadFlyer(files: FileList | null) {
    if (!files?.length) return;
    setUploadingFlyer(true);
    try {
      const urls = await uploadFiles(files);
      if (urls.length) set("flyerImage", urls[0]);
    } catch {
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setUploadingFlyer(false);
    }
  }

  async function uploadGallery(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_GALLERY - form.galleryImages.length;
    if (room <= 0) {
      toast.error(`Maximaal ${MAX_GALLERY} foto's.`);
      return;
    }
    setUploadingGallery(true);
    try {
      const picked = Array.from(files).slice(0, room);
      const dt = new DataTransfer();
      picked.forEach((f) => dt.items.add(f));
      const urls = await uploadFiles(dt.files);
      if (urls.length) set("galleryImages", [...form.galleryImages, ...urls].slice(0, MAX_GALLERY));
    } catch {
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setUploadingGallery(false);
    }
  }

  function removeGalleryImage(url: string) {
    set("galleryImages", form.galleryImages.filter((u) => u !== url));
  }

  const videoInvalid = form.videoUrl.trim().length > 0 && !isSupportedVideoUrl(form.videoUrl);

  return (
    <section className="space-y-8">
      {/* Banner */}
      <div className="space-y-3">
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
            onDrop={(e) => { e.preventDefault(); uploadCover(e.dataTransfer.files); }}
            className={`flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition hover:border-primary/50 hover:bg-muted/30 ${uploadingCover ? "pointer-events-none opacity-60" : ""}`}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadCover(e.target.files)} />
            {uploadingCover ? (
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
      </div>

      {/* Flyer */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Flyer <span className="text-sm font-normal text-muted-foreground">(optioneel)</span></h2>
        <p className="text-sm text-muted-foreground">
          De flyer of poster van je evenement — <strong>staand</strong> formaat. Bezoekers kunnen
          hem vergroten op de evenementpagina, handig voor alle details in één beeld.
        </p>

        {form.flyerImage ? (
          <div className="relative aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.flyerImage} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => set("flyerImage", "")}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
              aria-label="Verwijder flyer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); uploadFlyer(e.dataTransfer.files); }}
            className={`flex aspect-[3/4] w-full max-w-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition hover:border-primary/50 hover:bg-muted/30 ${uploadingFlyer ? "pointer-events-none opacity-60" : ""}`}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => uploadFlyer(e.target.files)} />
            {uploadingFlyer ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                <span className="mt-2 text-sm font-medium text-muted-foreground">Flyer uploaden</span>
                <span className="px-2 text-center text-xs text-muted-foreground/70">klik of sleep een afbeelding hierheen</span>
              </>
            )}
          </label>
        )}
      </div>

      {/* Impressiefoto's */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Impressiefoto&apos;s <span className="text-sm font-normal text-muted-foreground">(optioneel)</span></h2>
        <p className="text-sm text-muted-foreground">
          Foto&apos;s van eerdere edities geven bezoekers een goed beeld van de sfeer. Ze verschijnen
          in een galerij op de detailpagina. Maximaal {MAX_GALLERY}.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {form.galleryImages.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeGalleryImage(url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Verwijder foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {form.galleryImages.length < MAX_GALLERY && (
            <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:bg-muted/30 ${uploadingGallery ? "pointer-events-none opacity-60" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => uploadGallery(e.target.files)} />
              {uploadingGallery ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
              <span className="text-xs">Toevoegen</span>
            </label>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Video className="h-5 w-5" /> Video <span className="text-sm font-normal text-muted-foreground">(optioneel)</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Plak een <strong>YouTube</strong>- of <strong>Vimeo</strong>-link (bv. een aftermovie). De video wordt
          ingesloten op de detailpagina — we slaan zelf geen videobestanden op.
        </p>
        <input
          type="url"
          inputMode="url"
          value={form.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className={`w-full rounded-lg border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-1 ${
            videoInvalid ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400" : "border-border focus:border-primary focus:ring-primary"
          }`}
        />
        {videoInvalid && <p className="text-xs text-rose-500">Dit lijkt geen geldige YouTube- of Vimeo-link.</p>}
      </div>
    </section>
  );
}
