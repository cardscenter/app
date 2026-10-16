"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { saveTestimonial, deleteTestimonial } from "@/actions/admin/testimonials";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { ImageUploader } from "@/components/ui/image-uploader";

export interface TestimonialEditorRow {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  source: string;
  sourceUrl: string | null;
  avatarUrl: string | null;
  color: string;
  approved: boolean;
  featured: boolean;
  sortOrder: number;
}

const INPUT = "glass-input w-full rounded-lg px-3 py-2 text-sm";
const BTN = "inline-flex items-center gap-1.5 cc-pill cc-grad px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60";

const SOURCES: Array<{ value: string; label: string }> = [
  { value: "GOOGLE", label: "Google-review" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "DISCORD", label: "Discord" },
  { value: "IN_STORE", label: "In de winkel" },
  { value: "EMAIL", label: "E-mail" },
  { value: "OTHER", label: "Overig" },
];
const COLORS: Array<{ value: string; label: string; swatch: string }> = [
  { value: "white", label: "Wit", swatch: "#ffffff" },
  { value: "pink", label: "Roze", swatch: "var(--pastel-pink)" },
  { value: "yellow", label: "Geel", swatch: "var(--pastel-yellow)" },
  { value: "blue", label: "Blauw", swatch: "var(--pastel-blue)" },
  { value: "green", label: "Groen", swatch: "var(--pastel-green)" },
];

/** Formulier voor één ervaring (admin). Hardcoded NL zoals alle admin-schermen. */
export function TestimonialEditor({ row }: { row: TestimonialEditorRow | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [avatar, setAvatar] = useState<string[]>(row?.avatarUrl ? [row.avatarUrl] : []);
  const [color, setColor] = useState(row?.color ?? "white");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("avatarUrl", avatar[0] ?? "");
    fd.set("color", color);
    start(async () => {
      const r = await saveTestimonial(fd, row?.id ?? null);
      if ("error" in r) return void toast.error(r.error);
      toast.success("Opgeslagen");
      if (!row) router.push(`/dashboard/admin/testimonials/${r.id}`);
      else router.refresh();
    });
  }
  function remove() {
    if (!row || !confirm(`Ervaring van ${row.authorName} verwijderen?`)) return;
    start(async () => {
      const r = await deleteTestimonial(row.id);
      if ("error" in r) return void toast.error(r.error);
      router.push("/dashboard/admin/testimonials");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <FieldRow label="Quote" hint="Max 600 tekens. Zet een zinsdeel tussen dubbele sterretjes (**zo**) om het vet te tonen." htmlFor="quote">
        <textarea id="quote" name="quote" defaultValue={row?.quote ?? ""} rows={5} maxLength={600} className={INPUT} required />
      </FieldRow>
      <FieldRow label="Naam" hint="Voornaam of voornaam + eerste letter, zoals de speler het zelf wil." htmlFor="authorName">
        <input id="authorName" name="authorName" defaultValue={row?.authorName ?? ""} className={INPUT} required maxLength={80} />
      </FieldRow>
      <FieldRow label="Omschrijving" hint="Optioneel: bijvoorbeeld 'League-speler', 'Ouder van Finn' of 'Verzamelaar sinds 1999'." htmlFor="authorRole">
        <input id="authorRole" name="authorRole" defaultValue={row?.authorRole ?? ""} className={INPUT} maxLength={80} />
      </FieldRow>
      <FieldRow label="Bron" hint="Waar de quote vandaan komt; staat als pil op de kaart." htmlFor="source">
        <select id="source" name="source" defaultValue={row?.source ?? "IN_STORE"} className={INPUT}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Link naar de bron" hint="Optioneel, bijvoorbeeld de Google-review." htmlFor="sourceUrl">
        <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={row?.sourceUrl ?? ""} className={INPUT} maxLength={500} placeholder="https://" />
      </FieldRow>
      <FieldRow label="Foto" hint="Optioneel. Zonder foto tonen we de eerste letter van de naam.">
        <ImageUploader images={avatar} onChange={(imgs) => setAvatar(imgs.slice(-1))} maxImages={1} context="avatar" />
      </FieldRow>
      <FieldRow label="Kleur van de kaart" hint="Wit is de basis; pastels geven ritme op de muur.">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              aria-pressed={color === c.value}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${color === c.value ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"}`}
            >
              <span className="inline-block size-3.5 rounded-full border border-border" style={{ background: c.swatch }} />
              {c.label}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Volgorde" hint="Lager = eerder op de muur. Gelijke waarden: nieuwste eerst." htmlFor="sortOrder">
        <input id="sortOrder" name="sortOrder" type="number" min={0} max={9999} defaultValue={row?.sortOrder ?? 0} className={`${INPUT} max-w-[8rem]`} />
      </FieldRow>
      <FieldRow label="Zichtbaar" hint="Uit = alleen in dit overzicht.">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="approved" value="true" defaultChecked={row?.approved ?? true} className="size-4 accent-primary" /> Tonen op /ervaringen
        </label>
      </FieldRow>
      <FieldRow label="Homepage" hint="De homepage toont de rij vanaf drie uitgelichte quotes.">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" value="true" defaultChecked={row?.featured ?? false} className="size-4 accent-primary" /> Ook op de homepage
        </label>
      </FieldRow>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          {row && (
            <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-sm text-rose-600 hover:underline">
              <Trash2 className="size-3.5" /> Verwijderen
            </button>
          )}
        </div>
        <button type="submit" disabled={pending} className={BTN}>
          <Save className="size-4" /> Opslaan
        </button>
      </div>
    </form>
  );
}
