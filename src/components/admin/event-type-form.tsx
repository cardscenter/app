"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { saveEventType, toggleEventType } from "@/actions/admin/shop-events";
import { EVENT_TYPE_COLORS, eventColorClasses } from "@/lib/shop-events/config";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { POKEMON_DIVISIONS_2027, type AgeDivisionRule } from "@/lib/age";
import { EventTypePill } from "@/components/shop-events/event-type-pill";
import { INPUT, PILL_BTN_SM, PILL_RED, SELECT, TEXTAREA } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

export interface EventTypeRow {
  id: string;
  key: string;
  name: string;
  game: string | null;
  description: string | null;
  color: string;
  ageDivisions: string | null;
  defaultPrice: number;
  defaultCapacity: number | null;
  countsForLeague: boolean;
  countsForStampCard: boolean;
  enabled: boolean;
  sortOrder: number;
  eventCount: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Eén type: uitklapbare rij met formulier (incl. divisie-editor). */
export function EventTypeCard({ row, games, startOpen = false }: { row: EventTypeRow | null; games: Array<{ key: string; name: string }>; startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(row?.name ?? "");
  const [key, setKey] = useState(row?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!row);
  const [divisions, setDivisions] = useState<AgeDivisionRule[]>(() => {
    try {
      return row?.ageDivisions ? (JSON.parse(row.ageDivisions) as AgeDivisionRule[]) : [];
    } catch {
      return [];
    }
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("ageDivisions", divisions.length ? JSON.stringify(divisions.map((d) => ({ ...d, key: slugify(d.key || d.label), minBirthYear: d.minBirthYear || undefined, maxBirthYear: d.maxBirthYear || undefined }))) : "");
    startTransition(async () => {
      const r = await saveEventType(fd, row?.id ?? null);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Opgeslagen");
      if (!row) {
        setOpen(false);
        setName("");
        setKey("");
        setDivisions([]);
      }
      router.refresh();
    });
  }

  function toggle(enabled: boolean) {
    if (!row) return;
    startTransition(async () => {
      const r = await toggleEventType(row.id, enabled);
      if ("error" in r) toast.error(String(r.error));
      else router.refresh();
    });
  }

  const setDiv = (i: number, patch: Partial<AgeDivisionRule>) => setDivisions((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="dash-card">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        {row ? (
          <>
            <EventTypePill name={row.name} color={row.color} />
            <span className="text-xs text-muted-foreground">{row.key}</span>
            {row.game && <span className="text-xs text-muted-foreground">· {games.find((g) => g.key === row.game)?.name ?? row.game}</span>}
            <span className="text-xs text-muted-foreground">· {row.eventCount} events</span>
            <span className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={row.enabled} disabled={pending} onChange={(e) => toggle(e.target.checked)} className="accent-primary" /> Actief
              </label>
              <button type="button" onClick={() => setOpen((v) => !v)} className="cc-pill p-2 transition-colors hover:bg-[var(--background)]" aria-label="Bewerken">
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            </span>
          </>
        ) : (
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-[#8c1420]">
            <Plus className="size-4" /> Nieuw event-type
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={onSubmit} className="space-y-4 border-t border-border p-5 sm:p-6">
          <FieldRow label="Naam" htmlFor={`name-${row?.id ?? "new"}`}>
            <input
              id={`name-${row?.id ?? "new"}`}
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value));
              }}
              className={INPUT}
              required
            />
          </FieldRow>
          <FieldRow label="Sleutel" hint="Voor filters en links, bv. league-avond" htmlFor={`key-${row?.id ?? "new"}`}>
            <input id={`key-${row?.id ?? "new"}`} name="key" value={key} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} className={cn(INPUT, "font-mono")} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FieldRow>
          <FieldRow label="Spel" htmlFor={`game-${row?.id ?? "new"}`}>
            <select id={`game-${row?.id ?? "new"}`} name="game" defaultValue={row?.game ?? ""} className={SELECT}>
              <option value="">Geen / alle spellen</option>
              {games.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Kleur">
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPE_COLORS.map((c) => (
                <label key={c} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${eventColorClasses(c).pill}`}>
                  <input type="radio" name="color" value={c} defaultChecked={(row?.color ?? "blue") === c} className="accent-primary" /> {c}
                </label>
              ))}
            </div>
          </FieldRow>
          <FieldRow label="Beschrijving" htmlFor={`desc-${row?.id ?? "new"}`}>
            <textarea id={`desc-${row?.id ?? "new"}`} name="description" defaultValue={row?.description ?? ""} rows={2} maxLength={500} className={TEXTAREA} />
          </FieldRow>
          <FieldRow label="Standaard prijs en capaciteit" hint="Vooringevuld bij een nieuw event van dit type">
            <div className="grid grid-cols-2 gap-2">
              <input name="defaultPrice" type="number" step="0.01" min="0" max="500" defaultValue={row?.defaultPrice ?? 0} className={INPUT} />
              <input name="defaultCapacity" type="number" min="1" max="500" defaultValue={row?.defaultCapacity ?? ""} placeholder="capaciteit" className={INPUT} />
            </div>
          </FieldRow>
          <FieldRow label="Standaardregels">
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="countsForLeague" value="true" defaultChecked={row?.countsForLeague ?? false} className="accent-primary" /> Telt mee voor de league</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="countsForStampCard" value="true" defaultChecked={row?.countsForStampCard ?? true} className="accent-primary" /> Stempel bij check-in</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="enabled" value="true" defaultChecked={row?.enabled ?? true} className="accent-primary" /> Actief (kiesbaar bij een nieuw event)</label>
            </div>
          </FieldRow>
          <FieldRow label="Volgorde" htmlFor={`sort-${row?.id ?? "new"}`}>
            <input id={`sort-${row?.id ?? "new"}`} name="sortOrder" type="number" min="0" max="999" defaultValue={row?.sortOrder ?? 0} className={cn(INPUT, "w-24")} />
          </FieldRow>
          <FieldRow label="Leeftijdsdivisies" hint="Op geboortejaar. Leeg = geen divisies. De speler krijgt bij het boeken automatisch de juiste divisie.">
            <div className="space-y-2">
              {divisions.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_110px_110px_auto] items-center gap-2">
                  <input value={d.label} onChange={(e) => setDiv(i, { label: e.target.value })} placeholder="Label (Junior)" className={INPUT} />
                  <input value={d.key} onChange={(e) => setDiv(i, { key: e.target.value })} placeholder="sleutel" className={cn(INPUT, "font-mono")} />
                  <input type="number" value={d.minBirthYear ?? ""} onChange={(e) => setDiv(i, { minBirthYear: e.target.value ? Number(e.target.value) : undefined })} placeholder="vanaf jaar" className={INPUT} />
                  <input type="number" value={d.maxBirthYear ?? ""} onChange={(e) => setDiv(i, { maxBirthYear: e.target.value ? Number(e.target.value) : undefined })} placeholder="t/m jaar" className={INPUT} />
                  <button type="button" onClick={() => setDivisions((x) => x.filter((_, j) => j !== i))} className="cc-pill p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-destructive" aria-label="Verwijder">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={() => setDivisions((x) => [...x, { key: "", label: "" }])} className={PILL_BTN_SM}>
                  <Plus className="size-3.5" /> Divisie
                </button>
                <button type="button" onClick={() => setDivisions(POKEMON_DIVISIONS_2027.map((d) => ({ ...d })))} className={PILL_BTN_SM}>
                  Pokémon-defaults (Junior/Senior/Masters)
                </button>
              </div>
            </div>
          </FieldRow>
          <div className="flex justify-end border-t border-border pt-3">
            <button type="submit" disabled={pending} className={cn(PILL_RED, "disabled:opacity-60")}>
              <Save className="size-4" /> Opslaan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
