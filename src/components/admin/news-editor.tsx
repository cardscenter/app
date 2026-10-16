"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save, Trash2, Send, Eye } from "lucide-react";
import { saveNewsPost, deleteNewsPost, sendNewsletter } from "@/actions/admin/community";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { ImageUploader } from "@/components/ui/image-uploader";

export interface NewsEditorRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  pinned: boolean;
  status: string;
  newsletterSentAt: string | null;
  newsletterRecipients: number;
}

const INPUT = "glass-input w-full rounded-lg px-3 py-2 text-sm";
const BTN = "inline-flex items-center gap-1.5 cc-pill bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";
const BTN_OUTLINE = "inline-flex items-center gap-1.5 cc-pill border border-border bg-white px-4 py-2 text-sm font-semibold hover:bg-background disabled:opacity-60";

export function NewsEditor({ row, optInCount }: { row: NewsEditorRow | null; optInCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cover, setCover] = useState<string[]>(row?.coverImage ? [row.coverImage] : []);
  const [status, setStatus] = useState(row?.status ?? "DRAFT");

  function submit(e: React.FormEvent<HTMLFormElement>, newStatus?: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("coverImage", cover[0] ?? "");
    fd.set("status", newStatus ?? status);
    start(async () => {
      const r = await saveNewsPost(fd, row?.id ?? null);
      if ("error" in r) return void toast.error(r.error);
      toast.success(newStatus === "PUBLISHED" ? "Gepubliceerd" : "Opgeslagen");
      if (!row) router.push(`/dashboard/admin/news/${r.id}`);
      else router.refresh();
    });
  }
  function remove() {
    if (!row || !confirm(`"${row.title}" verwijderen?`)) return;
    start(async () => {
      const r = await deleteNewsPost(row.id);
      if ("error" in r) return void toast.error(r.error);
      router.push("/dashboard/admin/news");
    });
  }
  function newsletter() {
    if (!row || !confirm(`Nieuwsbrief versturen naar ${optInCount} leden met opt-in? Dit kan maar één keer per bericht.`)) return;
    start(async () => {
      const r = await sendNewsletter(row.id);
      if ("error" in r) return void toast.error(r.error);
      toast.success(`Verstuurd naar ${r.recipients} leden`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-5">
      <FieldRow label="Titel" htmlFor="title">
        <input id="title" name="title" defaultValue={row?.title ?? ""} className={INPUT} required maxLength={120} />
      </FieldRow>
      <FieldRow label="Samenvatting" hint="Korte intro voor de overzichtspagina en de nieuwsbrief (max 300 tekens)." htmlFor="excerpt">
        <textarea id="excerpt" name="excerpt" defaultValue={row?.excerpt ?? ""} rows={2} maxLength={300} className={INPUT} />
      </FieldRow>
      <FieldRow label="Tekst" hint="Platte tekst. Een lege regel begint een nieuwe alinea." htmlFor="body">
        <textarea id="body" name="body" defaultValue={row?.body ?? ""} rows={14} maxLength={20000} className={INPUT} required />
      </FieldRow>
      <FieldRow label="Omslagfoto" hint="Optioneel, liggend formaat werkt het best.">
        <ImageUploader images={cover} onChange={(imgs) => setCover(imgs.slice(-1))} maxImages={1} context="event" />
      </FieldRow>
      <FieldRow label="Vastpinnen" hint="Vastgepinde berichten staan bovenaan.">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="pinned" value="true" defaultChecked={row?.pinned ?? false} className="size-4 accent-primary" /> Bovenaan tonen
        </label>
      </FieldRow>
      <input type="hidden" name="status" value={status} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {row && (
            <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-sm text-rose-600 hover:underline">
              <Trash2 className="size-3.5" /> Verwijderen
            </button>
          )}
          {row?.status === "PUBLISHED" && (
            <a href={`/nl/nieuws/${row.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
              <Eye className="size-3.5" /> Bekijk
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row?.status === "PUBLISHED" &&
            (row.newsletterSentAt ? (
              <span className="text-xs text-muted-foreground">Nieuwsbrief verstuurd naar {row.newsletterRecipients} leden</span>
            ) : (
              <button type="button" onClick={newsletter} disabled={pending || optInCount === 0} className={BTN_OUTLINE} title={optInCount === 0 ? "Niemand heeft de nieuwsbrief aan" : undefined}>
                <Send className="size-4" /> Nieuwsbrief ({optInCount})
              </button>
            ))}
          {status === "PUBLISHED" ? (
            <button type="button" disabled={pending} onClick={() => setStatus("DRAFT")} className={BTN_OUTLINE}>
              Terug naar concept
            </button>
          ) : (
            <button type="submit" disabled={pending} onClick={(e) => { e.preventDefault(); submit({ preventDefault() {}, currentTarget: (e.currentTarget as HTMLButtonElement).form! } as unknown as React.FormEvent<HTMLFormElement>, "PUBLISHED"); }} className={BTN_OUTLINE}>
              Publiceren
            </button>
          )}
          <button type="submit" disabled={pending} className={BTN}>
            <Save className="size-4" /> {status === "PUBLISHED" ? "Opslaan" : "Concept opslaan"}
          </button>
        </div>
      </div>
    </form>
  );
}
