"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, Clock, Ban, BarChart3, Plus, Table2, Check, RefreshCw, MonitorSmartphone, ChevronDown, ChevronUp } from "lucide-react";
import { getKitchenBoard, kitchenAdvance, kitchenClearOld, kitchenDemoOrder, kitchenMarkPaid, kitchenSetSoldOut, kitchenSetWait } from "@/actions/staff/kitchen";
import type { OrderView, DayStats } from "@/lib/food/orders";
import type { MenuItemView } from "@/lib/food/menu-server";
import { WAIT_DEFAULT, WAIT_OPTIONS } from "@/lib/food/menu-data";
import { formatEuro } from "@/lib/food/pricing";
import type { MenuData } from "./food-types";

interface Board {
  open: OrderView[];
  finishedToday: number;
  olderCount: number;
  waitMinutes: number;
  soldOut: string[];
  stats: DayStats;
}

const POLL_MS = 5000;

/**
 * Keukenscherm (prototype `vKitchen`): kolommen Nieuw / In bereiding / Klaar,
 * wachttijd-chips, uitverkocht-paneel, geluid bij nieuwe bestelling, dag-
 * overzicht, voorbeeldbestelling, Wake Lock. Pollt elke 5 seconden.
 */
// Geluidsvoorkeur uit localStorage via useSyncExternalStore (geen setState in
// een effect). Geen abonnement nodig: alleen de knop hieronder schrijft 'm.
const subscribeNoop = () => () => {};
function readStoredSound(): boolean {
  try {
    return localStorage.getItem("cc-ksound") === "1";
  } catch {
    return false;
  }
}

export function KitchenBoard({ locale, menu }: { locale: string; menu: MenuData }) {
  const t = useTranslations("food");
  const lang = locale === "en" ? "en" : "nl";
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [soldOpen, setSoldOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const storedSound = useSyncExternalStore(subscribeNoop, readStoredSound, () => false);
  const [soundOverride, setSound] = useState<boolean | null>(null);
  const sound = soundOverride ?? storedSound;
  const [wake, setWake] = useState(false);
  const [pending, startTransition] = useTransition();
  // "Nu" als state (Date.now() mag niet tijdens het renderen); de klok tikt
  // elke 15s en elke poll ververst 'm ook.
  const [now, setNow] = useState(() => Date.now());
  const lastNew = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const nm = (it: MenuItemView) => (lang === "nl" ? it.name : it.nameEn);
  const fmt = (n: number) => formatEuro(n, lang);

  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = audioCtx.current ?? new Ctx();
      const c = audioCtx.current;
      if (c.state === "suspended") void c.resume();
      for (const d of [0, 0.2]) {
        const o = c.createOscillator();
        const g = c.createGain();
        const t0 = c.currentTime + d;
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.connect(g);
        g.connect(c.destination);
        o.start(t0);
        o.stop(t0 + 0.17);
      }
    } catch {
      // geen audio
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await getKitchenBoard();
      if ("error" in r) return;
      setBoard(r);
      setOffline(false);
      setUpdatedAt(new Date());
      setNow(Date.now());
      const n = r.open.filter((o) => o.status === "NEW").length;
      if (lastNew.current !== null && n > lastNew.current && sound) beep();
      lastNew.current = n;
    } catch {
      setOffline(true);
    }
  }, [sound, beep]);

  useEffect(() => {
    // Eerste poll via een microtask: load() zet pas state na een await, maar
    // zo roept het effect zelf geen setState-functie synchroon aan.
    void Promise.resolve().then(load);
    const id = setInterval(() => void load(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(id);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => () => void wakeLock.current?.release(), []);

  async function toggleWake() {
    try {
      if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
        setWake(false);
      } else {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (!nav.wakeLock) return;
        wakeLock.current = await nav.wakeLock.request("screen");
        setWake(true);
      }
    } catch {
      setWake(false);
    }
  }

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      await load();
    });

  if (!board) {
    return <div className="flex min-h-screen items-center justify-center text-[var(--ink-2)]">{t("kTitle")}…</div>;
  }
  const { open, waitMinutes, soldOut, stats } = board;
  const col = (status: OrderView["status"], title: string, isNew = false) => {
    const list = open.filter((o) => o.status === status);
    return (
      <section className="min-w-0 rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-3 flex items-center justify-between text-lg font-bold">
          {title}
          <span className={`rounded-full px-2.5 py-0.5 text-sm ${isNew && list.length ? "bg-[var(--red)] text-white" : "bg-[var(--wash)] text-[var(--ink-2)]"}`}>{list.length}</span>
        </h2>
        <div className="space-y-3">
          {list.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--ink-3)]">{t("kEmptyCol")}</div>}
          {list.map((o) => (
            <OrderCard key={o.id} o={o} now={now} menu={menu} lang={lang} t={t} fmt={fmt} pending={pending} onAdvance={(to) => act(() => kitchenAdvance(o.id, to))} onPaid={() => act(() => kitchenMarkPaid(o.id))} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t("kTitle")}</h1>
          <p className="text-sm text-[var(--ink-2)]">{open.length === 1 ? t("kSub1") : t("kSubN", { n: open.length })}{updatedAt && <> · {t("kUpdated", { t: updatedAt.toLocaleTimeString(lang === "nl" ? "nl-NL" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) })}</>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChipBtn active={sound} onClick={() => { const on = !sound; setSound(on); try { localStorage.setItem("cc-ksound", on ? "1" : "0"); } catch {} if (on) beep(); }}><Bell className="size-4" /> {sound ? t("kSoundOn") : t("kSoundOff")}</ChipBtn>
          <ChipBtn active={wake} onClick={toggleWake}><MonitorSmartphone className="size-4" /> {t("kWake")}</ChipBtn>
          <ChipBtn onClick={() => void load()}><RefreshCw className="size-4" /> {t("kRefresh")}</ChipBtn>
          <ChipBtn onClick={() => act(() => kitchenDemoOrder())} disabled={pending}><Plus className="size-4" /> {t("kDemo")}</ChipBtn>
        </div>
      </div>
      {offline && <div className="mt-3 rounded-xl bg-[var(--red-soft)] p-3 text-sm text-[var(--red-dark)]">{t("kOffline")}</div>}

      <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Clock className="size-4" /> {t("kWait")}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {WAIT_OPTIONS.map((n) => (
              <ChipBtn key={n} active={waitMinutes === n} onClick={() => act(() => kitchenSetWait(n))}>{t("kWaitMin", { n })}</ChipBtn>
            ))}
          </div>
        </div>
        <small className="mt-1 block text-xs text-[var(--ink-3)]">{t("kWaitHint", { n: WAIT_DEFAULT })}</small>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
        <button type="button" onClick={() => setSoldOpen((v) => !v)} aria-expanded={soldOpen} className="flex w-full items-center gap-2 text-sm font-semibold">
          <Ban className="size-4" /> {t("kSold")} <b className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-xs">{soldOut.length}</b>
          <span className="ml-auto">{soldOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
        </button>
        {soldOpen && (
          <div className="mt-2 space-y-2">
            <small className="block text-xs text-[var(--ink-3)]">{t("kSoldHint")}</small>
            {menu.categories.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-1.5">
                <span className="w-32 shrink-0 text-xs font-semibold text-[var(--ink-2)]">{lang === "nl" ? c.name : c.nameEn}</span>
                {menu.items.filter((i) => i.category === c.key).map((it) => (
                  <ChipBtn key={it.id} active={soldOut.includes(it.id)} tone="out" onClick={() => act(() => kitchenSetSoldOut(it.id, !soldOut.includes(it.id)))}>{nm(it)}</ChipBtn>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {col("NEW", t("kNew"), true)}
        {col("PREPARING", t("kPrep"))}
        {col("READY", t("kReady"))}
      </div>

      <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
        <button type="button" onClick={() => setDayOpen((v) => !v)} aria-expanded={dayOpen} className="flex w-full items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4" /> {t("kDay")} <b className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-xs">{stats.orders}</b>
          <span className="ml-auto">{dayOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
        </button>
        {dayOpen && (
          stats.orders ? (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[[t("kDayOrders"), String(stats.orders)], [t("kDayRevenue"), fmt(stats.revenue)], [t("kDayTip"), fmt(stats.tips)], [t("kDayOpen"), String(stats.open)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-[var(--wash)] p-3"><small className="block text-xs text-[var(--ink-3)]">{l}</small><b className="text-lg">{v}</b></div>
                ))}
              </div>
              <small className="mt-2 block text-xs text-[var(--ink-3)]">{t("kDayPaid", { a: stats.online, b: stats.bar })}</small>
              <span className="mt-3 block text-sm font-semibold">{t("kDayItems")}</span>
              <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {stats.items.map((x) => (
                  <li key={x.id} className="flex gap-2"><b className="w-8 tabular-nums">{x.qty}×</b><span>{menu.byId[x.id] ? nm(menu.byId[x.id]) : x.id}</span></li>
                ))}
              </ul>
            </div>
          ) : (
            <small className="mt-2 block text-xs text-[var(--ink-3)]">{t("kDayEmpty")}</small>
          )
        )}
      </div>

      <p className="mt-4 text-center text-xs text-[var(--ink-3)]">
        {t("kFinished", { n: board.finishedToday })}
        {board.olderCount > 0 && (
          <> · <button type="button" onClick={() => confirm(t("kClear", { n: board.olderCount }) + "?") && act(() => kitchenClearOld())} className="underline">{t("kClear", { n: board.olderCount })}</button></>
        )}
      </p>
    </div>
  );
}

function ChipBtn({ children, active, onClick, disabled, tone }: { children: React.ReactNode; active?: boolean; onClick?: () => void; disabled?: boolean; tone?: "out" }) {
  const activeCls = tone === "out" ? "border-[var(--red-dark)] bg-[var(--red-soft)] text-[var(--red-dark)] line-through" : "border-[var(--ink)] bg-[var(--ink)] text-white";
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-40 ${active ? activeCls : "border-[var(--line)] bg-white hover:bg-[var(--wash)]"}`}>
      {children}
    </button>
  );
}

type KitchenRow = { q: number; n: string; s: Array<{ x: string; mod?: boolean }> };

// Buiten OrderCard gedeclareerd (react-hooks/static-components).
function List({ title, rows }: { title: string; rows: KitchenRow[] }) {
  return (
    <div className="mt-2">
      <small className="block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-3)]">{title}</small>
      <ul className="mt-1 space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-2"><b className="w-7 shrink-0 tabular-nums">{r.q}×</b><span>{r.n}{r.s.map((x, j) => <em key={j} className={`ml-1.5 rounded px-1.5 text-xs not-italic ${x.mod ? "bg-[var(--red-soft)] font-bold text-[var(--red-dark)]" : "bg-[var(--wash)] text-[var(--ink-2)]"}`}>{x.x}</em>)}</span></li>
        ))}
      </ul>
    </div>
  );
}

function OrderCard({ o, now, menu, lang, t, fmt, pending, onAdvance, onPaid }: { o: OrderView; now: number; menu: MenuData; lang: string; t: ReturnType<typeof useTranslations<"food">>; fmt: (n: number) => string; pending: boolean; onAdvance: (to: OrderView["status"]) => void; onPaid: () => void }) {
  const tb = o.mode === "TABLE";
  const nm = (it: MenuItemView) => (lang === "nl" ? it.name : it.nameEn);
  const startTs = new Date(o.paidAt ?? o.createdAt).getTime();
  const mins = (now - startTs) / 60000;
  const ageMin = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
  const late = o.paid && mins >= (o.waitMinutes || WAIT_DEFAULT) && o.status !== "READY";
  const awaiting = o.status === "NEW" && !o.paid;
  const food: Array<{ q: number; n: string; s: Array<{ x: string; mod?: boolean }> }> = [];
  const drinks: typeof food = [];
  for (const l of o.lines) {
    const it = menu.byId[l.id];
    if (!it) continue;
    const s: Array<{ x: string; mod?: boolean }> = [];
    if (l.g && l.role !== "main") s.push({ x: t("kWithMenu") });
    if (it.category === "drank") {
      drinks.push({ q: l.qty, n: nm(it), s });
      continue;
    }
    if (it.category === "sauzen") s.unshift({ x: t("kSauce") });
    for (const i of l.removed) s.push({ x: `${t("without").toUpperCase()} ${(lang === "nl" ? it.ingredients[i]?.nl : it.ingredients[i]?.en)?.toLowerCase() ?? ""}`, mod: true });
    food.push({ q: l.qty, n: nm(it), s });
  }
  const btn = { NEW: ["PREPARING", t("kStart"), "btn-grad"], PREPARING: ["READY", t("kDoneBtn"), "btn-grad"], READY: ["DONE", t(tb ? "kServed" : "kPicked"), "border border-[var(--line)] bg-white"] }[o.status as "NEW" | "PREPARING" | "READY"];
  return (
    <article className={`rounded-xl border-2 p-3 ${o.status === "NEW" ? "border-[var(--red)]" : "border-[var(--line)]"} ${late ? "bg-[var(--red-soft)]" : "bg-white"}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-extrabold tabular-nums">#{o.number}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wash)] px-2.5 py-0.5 text-xs font-semibold">{tb ? <Table2 className="size-3.5" /> : <Bell className="size-3.5" />}{tb ? t("ctxT", { n: o.table ?? 0 }) : o.name}</span>
        <span className={`ml-auto text-xs font-semibold ${late ? "text-[var(--red-dark)]" : "text-[var(--ink-3)]"}`}>{ageMin < 1 ? t("kNow") : t("kMin", { n: ageMin })}</span>
      </div>
      {o.paid ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-[var(--green-soft)] px-2 py-1 text-xs font-semibold text-[var(--green)]"><Check className="size-3.5" /> {t("kPaid", { m: o.payment === "BAR" ? t("payBar") : o.method ?? t("online") })}</div>
      ) : (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--amber-soft)] px-2 py-1.5 text-xs font-semibold">
          <span>{t("kDue")} · {fmt(o.total)}</span>
          <button type="button" disabled={pending} onClick={onPaid} className="ml-auto rounded-md bg-[var(--ink)] px-2 py-1 text-white disabled:opacity-50">{t("kMarkPaid")}</button>
        </div>
      )}
      {food.length > 0 && <List title={t("kKitchen")} rows={food} />}
      {drinks.length > 0 && <List title={t("kBar")} rows={drinks} />}
      {o.code && <div className="mt-2 text-xs text-[var(--ink-2)]">{t("kCode")}: <b>{o.code}</b> · - {fmt(o.discount)}</div>}
      {o.note && <div className="mt-2 rounded-md bg-[var(--wash)] px-2 py-1.5 text-sm"><b className="block text-[11px] uppercase tracking-wide text-[var(--ink-3)]">{t("kNote")}</b>{o.note}</div>}
      {btn && (
        awaiting ? (
          <button type="button" disabled className="mt-3 w-full rounded-xl border border-[var(--line)] py-2.5 text-sm font-semibold text-[var(--ink-3)]">{t("kAwaitPay")}</button>
        ) : (
          <button type="button" disabled={pending} onClick={() => onAdvance(btn[0] as OrderView["status"])} className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 ${btn[2]}`}>{btn[1]}</button>
        )
      )}
    </article>
  );
}
