"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Stamp, Coins, MinusCircle, PlusCircle } from "lucide-react";
import { findPlayers, getPlayerLoyalty, giveStamp, givePoints, redeemPlayerPoints } from "@/actions/staff/community";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StampCard } from "@/components/community/stamp-card";

type Hit = { id: string; displayName: string; fullName: string; avatarUrl: string | null; stamps: number; points: number };
type Detail = NonNullable<Awaited<ReturnType<typeof getPlayerLoyalty>>>;

const BTN = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

/** Kassa-scherm: speler zoeken, stempel geven, punten bijschrijven of inwisselen. */
export function LoyaltyDesk() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) return setHits([]);
    start(async () => setHits(await findPlayers(v)));
  }
  async function load(id: string) {
    const d = await getPlayerLoyalty(id);
    setDetail(d);
    setHits([]);
    setQ("");
  }
  function run(fn: () => Promise<{ error?: string } | Record<string, unknown>>, okMsg: string) {
    if (!detail) return;
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) {
        toast.error(String(r.error));
        return;
      }
      toast.success(okMsg);
      setReason("");
      await load(detail.user.id);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="dash-card p-4">
        <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => search(e.target.value)} placeholder="Zoek speler op naam of e-mail" className="w-full bg-transparent text-sm outline-none" autoFocus />
        </label>
        <ul className="mt-2 divide-y divide-border">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => load(h.id)} className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-muted">
                <UserAvatar src={h.avatarUrl} name={h.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.fullName}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {h.stamps} st · {h.points} pt
                </span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && hits.length === 0 && !pending && <li className="px-2 py-3 text-sm text-muted-foreground">Geen speler gevonden.</li>}
        </ul>
      </div>

      <div className="dash-card p-4">
        {!detail ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Zoek links een speler om stempels of punten te geven.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <UserAvatar src={detail.user.avatarUrl} name={detail.user.displayName} size="lg" />
              <div>
                <p className="text-lg font-semibold">{detail.user.displayName}</p>
                <p className="text-sm text-muted-foreground">{[detail.user.firstName, detail.user.lastName].filter(Boolean).join(" ")}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold tabular-nums">{detail.points.balance}</p>
                <p className="text-xs text-muted-foreground">spaarpunten</p>
              </div>
            </div>
            <StampCard onCard={detail.stamps.onCard} perCard={detail.stamps.perCard} label={`${detail.stamps.onCard} van ${detail.stamps.perCard} stempels · ${detail.stamps.completedCards} volle kaart(en)`} />
            <p className="text-sm text-muted-foreground">Beloning volle kaart: {detail.stamps.reward}</p>

            <div className="space-y-3 border-t border-border pt-4">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Reden (optioneel), bv. gratis drankje, Pokémon-avond" className="glass-input w-full rounded-md px-3 py-2 text-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={pending} onClick={() => run(() => giveStamp(detail.user.id, reason), "Stempel gegeven")} className={`${BTN} bg-amber-500 text-white hover:bg-amber-600`}>
                  <Stamp className="size-4" /> Stempel geven
                </button>
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="number" min={1} max={1000} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="glass-input w-20 rounded-md px-2 py-1.5 text-sm" />
                  punten
                </label>
                <button type="button" disabled={pending} onClick={() => run(() => givePoints(detail.user.id, points, reason), `${points} punten bijgeschreven`)} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700`}>
                  <PlusCircle className="size-4" /> Bijschrijven
                </button>
                <button type="button" disabled={pending || detail.points.balance < points} onClick={() => run(() => redeemPlayerPoints(detail.user.id, points, reason), `${points} punten ingewisseld`)} className={`${BTN} border border-border bg-card hover:bg-muted`}>
                  <MinusCircle className="size-4" /> Inwisselen
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Coins className="size-3.5" /> Laatste mutaties
              </p>
              <ul className="divide-y divide-border text-sm">
                {detail.recent.length === 0 && <li className="py-2 text-muted-foreground">Nog niets.</li>}
                {detail.recent.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-1.5">
                    <span className="truncate">{e.reason}</span>
                    <span className={`ml-3 shrink-0 tabular-nums ${e.delta < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {e.delta > 0 ? "+" : ""}
                      {e.delta} {e.kind === "STAMP" ? "st" : "pt"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
