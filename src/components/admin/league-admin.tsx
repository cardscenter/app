"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2, ChevronDown, ChevronUp, Play, Square, Award } from "lucide-react";
import { saveLeagueSeason, setLeagueSeasonStatus, deleteLeagueSeason, saveLeagueBadge, deleteLeagueBadge } from "@/actions/admin/community";
import { FieldRow } from "@/components/dashboard/ui/field-row";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { EVENT_TYPE_COLORS, eventColorClasses } from "@/lib/shop-events/config";
import { BADGE_CRITERIA, BADGE_CRITERION_LABEL } from "@/lib/community/config";
import { LeagueBadgePill } from "@/components/community/league-badge-pill";
import { INPUT, PILL_BTN, PILL_RED, SELECT, TEXTAREA } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

const BTN = cn(PILL_RED, "px-4 py-2 disabled:opacity-60");
const BTN_OUTLINE = cn(PILL_BTN, "disabled:opacity-60");

export interface SeasonRow {
  id: string;
  name: string;
  game: string | null;
  description: string | null;
  startsAt: string; // yyyy-mm-dd
  endsAt: string;
  status: string;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  pointsParticipation: number;
  resultCount: number;
  playerCount: number;
}

const SEASON_TONE: Record<string, "success" | "warning" | "neutral"> = { ACTIVE: "success", DRAFT: "warning", CLOSED: "neutral" };
const SEASON_LABEL: Record<string, string> = { ACTIVE: "Actief", DRAFT: "Concept", CLOSED: "Afgesloten" };

export function SeasonCard({ row, games, startOpen = false }: { row: SeasonRow | null; games: Array<{ key: string; name: string }>; startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveLeagueSeason(fd, row?.id ?? null);
      if ("error" in r) return void toast.error(r.error);
      toast.success("Seizoen opgeslagen");
      if (!row) setOpen(false);
      router.refresh();
    });
  }
  function status(s: "DRAFT" | "ACTIVE" | "CLOSED") {
    if (!row) return;
    if (s === "CLOSED" && !confirm("Seizoen afsluiten? Daarna kunnen er geen uitslagen meer bij.")) return;
    start(async () => {
      const r = await setLeagueSeasonStatus(row.id, s);
      if ("error" in r) return void toast.error(r.error);
      toast.success(`Seizoen ${SEASON_LABEL[s].toLowerCase()}`);
      router.refresh();
    });
  }
  function remove() {
    if (!row || !confirm(`Seizoen "${row.name}" verwijderen?`)) return;
    start(async () => {
      const r = await deleteLeagueSeason(row.id);
      if ("error" in r) return void toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="dash-card">
      <div className="flex items-center gap-3 px-5 py-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {row ? (
            <>
              <StatusBadge tone={SEASON_TONE[row.status] ?? "neutral"}>{SEASON_LABEL[row.status] ?? row.status}</StatusBadge>
              <span className="truncate font-semibold">{row.name}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {row.startsAt} t/m {row.endsAt} · {row.playerCount} spelers · {row.resultCount} uitslagen
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <Plus className="size-4" /> Nieuw seizoen
            </span>
          )}
        </button>
        {row && row.status !== "ACTIVE" && row.status !== "CLOSED" && (
          <button type="button" onClick={() => status("ACTIVE")} disabled={pending} className={BTN} title="Activeren">
            <Play className="size-3.5" /> Activeren
          </button>
        )}
        {row && row.status === "ACTIVE" && (
          <button type="button" onClick={() => status("CLOSED")} disabled={pending} className={BTN_OUTLINE}>
            <Square className="size-3.5" /> Afsluiten
          </button>
        )}
        {row && row.status === "CLOSED" && (
          <button type="button" onClick={() => status("ACTIVE")} disabled={pending} className={BTN_OUTLINE}>
            Heropenen
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="cc-pill p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground" aria-label="Uitklappen">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>
      {open && (
        <form onSubmit={onSubmit} className="space-y-4 border-t border-border p-5 sm:p-6">
          <FieldRow label="Naam" htmlFor={`name-${row?.id ?? "new"}`}>
            <input id={`name-${row?.id ?? "new"}`} name="name" defaultValue={row?.name ?? ""} className={INPUT} required maxLength={80} placeholder="bv. Winter 2027" />
          </FieldRow>
          <FieldRow label="Spel" hint="Leeg = alle spellen tellen mee." htmlFor={`game-${row?.id ?? "new"}`}>
            <select id={`game-${row?.id ?? "new"}`} name="game" defaultValue={row?.game ?? ""} className={SELECT}>
              <option value="">Alle spellen</option>
              {games.map((g) => (
                <option key={g.key} value={g.key}>{g.name}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Periode" htmlFor={`startsAt-${row?.id ?? "new"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input id={`startsAt-${row?.id ?? "new"}`} name="startsAt" type="date" defaultValue={row?.startsAt ?? ""} className={cn(INPUT, "w-44")} required />
              <span className="text-sm text-muted-foreground">t/m</span>
              <input name="endsAt" type="date" defaultValue={row?.endsAt ?? ""} className={cn(INPUT, "w-44")} required />
            </div>
          </FieldRow>
          <FieldRow label="Punten" hint="Per partij: winst / gelijk / verlies, plus een bonus per gespeeld event. Wijzigen herberekent bestaande uitslagen.">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1">W <input name="pointsWin" type="number" min={0} max={100} defaultValue={row?.pointsWin ?? 3} className={cn(INPUT, "w-16")} /></label>
              <label className="inline-flex items-center gap-1">G <input name="pointsDraw" type="number" min={0} max={100} defaultValue={row?.pointsDraw ?? 1} className={cn(INPUT, "w-16")} /></label>
              <label className="inline-flex items-center gap-1">V <input name="pointsLoss" type="number" min={0} max={100} defaultValue={row?.pointsLoss ?? 0} className={cn(INPUT, "w-16")} /></label>
              <label className="inline-flex items-center gap-1">Meedoen <input name="pointsParticipation" type="number" min={0} max={100} defaultValue={row?.pointsParticipation ?? 1} className={cn(INPUT, "w-16")} /></label>
            </div>
          </FieldRow>
          <FieldRow label="Omschrijving" htmlFor={`desc-${row?.id ?? "new"}`}>
            <textarea id={`desc-${row?.id ?? "new"}`} name="description" defaultValue={row?.description ?? ""} rows={2} maxLength={2000} className={TEXTAREA} />
          </FieldRow>
          <div className="flex items-center justify-between border-t border-border pt-3">
            {row && row.resultCount === 0 ? (
              <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-sm font-semibold text-destructive hover:underline">
                <Trash2 className="size-3.5" /> Verwijderen
              </button>
            ) : <span />}
            <button type="submit" disabled={pending} className={BTN}>
              <Save className="size-4" /> Opslaan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export interface BadgeRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  criterion: string;
  threshold: number;
  sortOrder: number;
  enabled: boolean;
  awardCount: number;
}

export function BadgeCard({ row }: { row: BadgeRow | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!row);
  const [pending, start] = useTransition();
  const [color, setColor] = useState(row?.color ?? "amber");
  const id = row?.id ?? "new";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveLeagueBadge(fd, row?.id ?? null);
      if ("error" in r) return void toast.error(r.error);
      toast.success("Badge opgeslagen");
      router.refresh();
      if (!row) (e.target as HTMLFormElement).reset();
    });
  }
  function remove() {
    if (!row || !confirm(`Badge "${row.name}" verwijderen? Toegekende badges verdwijnen ook bij spelers.`)) return;
    start(async () => {
      await deleteLeagueBadge(row.id);
      router.refresh();
    });
  }

  return (
    <div className="dash-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        {row ? (
          <>
            <LeagueBadgePill name={row.name} color={row.color} size="sm" />
            <span className="text-sm text-muted-foreground">
              {BADGE_CRITERION_LABEL[row.criterion as keyof typeof BADGE_CRITERION_LABEL] ?? row.criterion} ≥ {row.threshold} · {row.awardCount}× toegekend
            </span>
            {!row.enabled && <StatusBadge tone="neutral">Uit</StatusBadge>}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Plus className="size-4" /> Nieuwe badge
          </span>
        )}
        <span className="ml-auto text-muted-foreground">{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
      </button>
      {open && (
        <form onSubmit={onSubmit} className="space-y-4 border-t border-border p-5 sm:p-6">
          <FieldRow label="Naam" htmlFor={`bname-${id}`}>
            <input id={`bname-${id}`} name="name" defaultValue={row?.name ?? ""} className={INPUT} required maxLength={60} />
          </FieldRow>
          <FieldRow label="Sleutel" hint="Vast kenmerk, kleine letters en streepjes." htmlFor={`bkey-${id}`}>
            <input id={`bkey-${id}`} name="key" defaultValue={row?.key ?? ""} className={INPUT} required pattern="[a-z0-9-]+" maxLength={40} />
          </FieldRow>
          <FieldRow label="Omschrijving" htmlFor={`bdesc-${id}`}>
            <input id={`bdesc-${id}`} name="description" defaultValue={row?.description ?? ""} className={INPUT} maxLength={300} />
          </FieldRow>
          <FieldRow label="Voorwaarde" htmlFor={`bcrit-${id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <select id={`bcrit-${id}`} name="criterion" defaultValue={row?.criterion ?? "TOTAL_EVENTS"} className={cn(SELECT, "w-auto")}>
                {BADGE_CRITERIA.map((c) => (
                  <option key={c} value={c}>{BADGE_CRITERION_LABEL[c]}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">minimaal</span>
              <input name="threshold" type="number" min={1} max={100000} defaultValue={row?.threshold ?? 1} className={cn(INPUT, "w-24")} required />
            </div>
          </FieldRow>
          <FieldRow label="Kleur">
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`size-7 rounded-full ${eventColorClasses(c).dot} ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-70"}`} aria-label={c} />
              ))}
              <input type="hidden" name="color" value={color} />
            </div>
          </FieldRow>
          <FieldRow label="Volgorde en status">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-1">Volgorde <input name="sortOrder" type="number" min={0} max={10000} defaultValue={row?.sortOrder ?? 100} className={cn(INPUT, "w-20")} /></label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" name="enabled" value="true" defaultChecked={row?.enabled ?? true} className="size-4 accent-primary" /> Actief</label>
            </div>
          </FieldRow>
          <div className="flex items-center justify-between border-t border-border pt-3">
            {row ? (
              <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 text-sm font-semibold text-destructive hover:underline">
                <Trash2 className="size-3.5" /> Verwijderen
              </button>
            ) : <span />}
            <button type="submit" disabled={pending} className={BTN}>
              <Award className="size-4" /> Opslaan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
