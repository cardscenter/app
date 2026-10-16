"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Save, Trash2, Search, UserPlus, Check } from "lucide-react";
import { saveLeagueResult, removeLeagueResult, findPlayers } from "@/actions/staff/community";
import { UserAvatar } from "@/components/ui/user-avatar";

export interface SheetRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  checkedIn: boolean;
  result: { id: string; wins: number; losses: number; draws: number; bonusPoints: number; points: number; note: string | null } | null;
}

const NUM = "glass-input w-14 rounded-md px-2 py-1 text-center text-sm";

function Row({ row, seasonId, eventId }: { row: SheetRow; seasonId: string; eventId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wins, setWins] = useState(row.result?.wins ?? 0);
  const [losses, setLosses] = useState(row.result?.losses ?? 0);
  const [draws, setDraws] = useState(row.result?.draws ?? 0);
  const [bonus, setBonus] = useState(row.result?.bonusPoints ?? 0);
  const [note, setNote] = useState(row.result?.note ?? "");
  const dirty = !row.result || wins !== row.result.wins || losses !== row.result.losses || draws !== row.result.draws || bonus !== row.result.bonusPoints || note !== (row.result.note ?? "");

  function save() {
    start(async () => {
      const r = await saveLeagueResult({ seasonId, eventId, userId: row.userId, wins, losses, draws, bonusPoints: bonus, note });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`${row.displayName}: ${r.points} punten`);
      router.refresh();
    });
  }
  function remove() {
    if (!row.result || !confirm(`Uitslag van ${row.displayName} verwijderen?`)) return;
    start(async () => {
      await removeLeagueResult(row.result!.id);
      router.refresh();
    });
  }

  return (
    <tr className={row.result && !dirty ? "bg-emerald-500/5" : ""}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <UserAvatar src={row.avatarUrl} name={row.displayName} size="xs" />
          <span className="font-medium">{row.displayName}</span>
          {row.checkedIn ? <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">ingecheckt</span> : <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">niet ingecheckt</span>}
        </div>
      </td>
      <td className="px-2 py-2 text-center"><input type="number" min={0} max={99} value={wins} onChange={(e) => setWins(Number(e.target.value))} className={NUM} aria-label="Winst" /></td>
      <td className="px-2 py-2 text-center"><input type="number" min={0} max={99} value={losses} onChange={(e) => setLosses(Number(e.target.value))} className={NUM} aria-label="Verlies" /></td>
      <td className="px-2 py-2 text-center"><input type="number" min={0} max={99} value={draws} onChange={(e) => setDraws(Number(e.target.value))} className={NUM} aria-label="Gelijk" /></td>
      <td className="px-2 py-2 text-center"><input type="number" min={-99} max={99} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className={NUM} aria-label="Bonus" /></td>
      <td className="px-2 py-2"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Notitie" className="glass-input w-full min-w-[8rem] rounded-md px-2 py-1 text-sm" /></td>
      <td className="px-2 py-2 text-right tabular-nums font-semibold">{row.result && !dirty ? row.result.points : "–"}</td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1">
          <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">
            {row.result && !dirty ? <Check className="size-3.5" /> : <Save className="size-3.5" />} {row.result && !dirty ? "Opgeslagen" : "Opslaan"}
          </button>
          {row.result && (
            <button type="button" onClick={remove} disabled={pending} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-rose-600" title="Verwijderen">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Uitslagen-blad per event: W/V/G + bonus per deelnemer, plus spelers toevoegen die niet ingeschreven stonden. */
export function ResultSheet({ rows, seasonId, eventId }: { rows: SheetRow[]; seasonId: string; eventId: string | null }) {
  const [extra, setExtra] = useState<SheetRow[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; displayName: string; fullName: string; avatarUrl: string | null }>>([]);
  const [searching, start] = useTransition();
  const all = [...rows, ...extra.filter((e) => !rows.some((r) => r.userId === e.userId))];

  function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) {
      setHits([]);
      return;
    }
    start(async () => setHits(await findPlayers(v)));
  }
  function add(h: { id: string; displayName: string; avatarUrl: string | null }) {
    if (!all.some((r) => r.userId === h.id)) setExtra((x) => [...x, { userId: h.id, displayName: h.displayName, avatarUrl: h.avatarUrl, checkedIn: false, result: null }]);
    setQ("");
    setHits([]);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Speler</th>
              <th className="px-2 py-2">W</th>
              <th className="px-2 py-2">V</th>
              <th className="px-2 py-2">G</th>
              <th className="px-2 py-2">Bonus</th>
              <th className="px-2 py-2 text-left">Notitie</th>
              <th className="px-2 py-2 text-right">Punten</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {all.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Geen deelnemers. Voeg hieronder een speler toe.</td>
              </tr>
            )}
            {all.map((r) => (
              <Row key={r.userId} row={r} seasonId={seasonId} eventId={eventId} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="relative border-t border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <UserPlus className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => search(e.target.value)} placeholder="Speler toevoegen (naam of e-mail)" className="glass-input w-full max-w-sm rounded-md px-3 py-1.5 text-sm" />
          {searching && <Search className="size-4 animate-pulse text-muted-foreground" />}
        </label>
        {hits.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-w-sm rounded-md border border-border bg-card shadow-lg">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => add(h)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                  <UserAvatar src={h.avatarUrl} name={h.displayName} size="xs" />
                  <span className="font-medium">{h.displayName}</span>
                  <span className="text-xs text-muted-foreground">{h.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
