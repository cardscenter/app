"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Stamp, Coins, MinusCircle, PlusCircle } from "lucide-react";
import { findPlayers, getPlayerLoyalty, giveStamp, givePoints, redeemPlayerPoints } from "@/actions/staff/community";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StampCardVisual } from "@/components/community/stamp-card-visual";
import { INPUT, LABEL, PILL_BTN, PILL_INK, PILL_RED } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

type Hit = { id: string; displayName: string; fullName: string; avatarUrl: string | null; stamps: number; points: number };
type Detail = NonNullable<Awaited<ReturnType<typeof getPlayerLoyalty>>>;

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
      <div className="dash-card p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => search(e.target.value)} placeholder="Zoek speler op naam of e-mail" className={cn(INPUT, "py-2.5 pl-9")} autoFocus />
        </div>
        <ul className="mt-2 space-y-0.5">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => load(h.id)} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--background)]">
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

      <div className="dash-card p-5">
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
                <p className="cc-display text-3xl tabular-nums">{detail.points.balance}</p>
                <p className="text-xs text-muted-foreground">spaarpunten</p>
              </div>
            </div>
            <div className="rounded-[20px] bg-[var(--pastel-yellow)] p-4 text-[var(--pastel-yellow-ink)]">
              <StampCardVisual total={detail.stamps.perCard} filled={detail.stamps.onCard} seed={detail.user.id} />
              <p className="mt-3 text-center text-sm font-semibold">
                {detail.stamps.onCard} van {detail.stamps.perCard} stempels · {detail.stamps.completedCards} volle kaart(en)
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Beloning volle kaart: {detail.stamps.reward}</p>

            <div className="space-y-3 border-t border-border pt-4">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Reden (optioneel), bv. gratis drankje, Pokémon-avond" className={cn(INPUT, "py-2.5")} aria-label="Reden" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={pending} onClick={() => run(() => giveStamp(detail.user.id, reason), "Stempel gegeven")} className={cn(PILL_RED, "disabled:opacity-50")}>
                  <Stamp className="size-4" /> Stempel geven
                </button>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="number" min={1} max={1000} value={points} onChange={(e) => setPoints(Number(e.target.value))} className={cn(INPUT, "w-20 py-2")} />
                  punten
                </label>
                <button type="button" disabled={pending} onClick={() => run(() => givePoints(detail.user.id, points, reason), `${points} punten bijgeschreven`)} className={cn(PILL_INK, "disabled:opacity-50")}>
                  <PlusCircle className="size-4" /> Bijschrijven
                </button>
                <button type="button" disabled={pending || detail.points.balance < points} onClick={() => run(() => redeemPlayerPoints(detail.user.id, points, reason), `${points} punten ingewisseld`)} className={cn(PILL_BTN, "disabled:opacity-50")}>
                  <MinusCircle className="size-4" /> Inwisselen
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className={cn(LABEL, "flex items-center gap-1.5")}>
                <Coins className="size-3.5" /> Laatste mutaties
              </p>
              <ul className="divide-y divide-border text-sm">
                {detail.recent.length === 0 && <li className="py-2 text-muted-foreground">Nog niets.</li>}
                {detail.recent.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-1.5">
                    <span className="truncate">{e.reason}</span>
                    <span className={`ml-3 shrink-0 font-semibold tabular-nums ${e.delta < 0 ? "text-destructive" : "text-[var(--pastel-green-ink)]"}`}>
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
