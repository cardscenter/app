"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Plus, Minus, Pencil, Info, Bell, Table2, Clock, Lock, Check, RefreshCw, Utensils, ShieldCheck, Coins } from "lucide-react";
import { getMenuState, placeFoodOrder, checkDiscountCode, getMyFoodPoints } from "@/actions/food-orders";
import type { MenuItemView } from "@/lib/food/menu-server";
import { TIPS, NOTE_MAX, NAME_MAX, type FlowKey } from "@/lib/food/menu-data";
import {
  addCombo,
  addLooseLine,
  basketCount,
  basketSavings,
  basketTotal,
  changeQty,
  discountAmount,
  drinksOnly,
  formatEuro,
  groupSig,
  groupsOf,
  hasSoldOut,
  lineKey,
  linePrice,
  nextStepIndex,
  normalizeCode,
  pointsToApply,
  removeLine,
  round2,
  setLineRemoved,
  stepsFor,
  unitDeal,
  type BasketLine,
  type DiscountRule,
  type ItemLookup,
} from "@/lib/food/pricing";
import type { MenuData, Screen, Sheet, SheetCombo, SheetCustom } from "./food-types";
import { useFoodSession } from "./use-food-session";
import { FoodSheets } from "./food-sheets";
import { ItemArt } from "./menu-art";
import { Btn, Chip, Eyebrow, Spice, Toast, TopBar } from "./food-ui";

interface Props {
  locale: string;
  menu: MenuData;
  waitMinutes: number;
  entry: { mode: "TABLE" | "BAR"; table: number } | { invalidTable: true } | null;
}

const METHODS = [
  { id: "ideal", name: "iDEAL", subKey: "idealSub", bg: "#CC0066", short: "iDEAL" },
  { id: "bancontact", name: "Bancontact", subKey: "bcSub", bg: "#1E3764", short: "BC" },
  { id: "applepay", name: "Apple Pay", subKey: "apSub", bg: "#111111", short: "Pay" },
  { id: "card", name: null, subKey: "cardSub", bg: "#5E5C61", short: "💳" },
] as const;

export function BestelApp({ locale, menu, waitMinutes: waitInitial, entry }: Props) {
  const t = useTranslations("food");
  const router = useRouter();
  const lang = locale === "en" ? "en" : "nl";
  const { session, setSession, ready } = useFoodSession();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState(false);
  const [tip, setTip] = useState<number>(0);
  const [method, setMethod] = useState<string>("ideal");
  const [payOpen, setPayOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeIn, setCodeIn] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [codeRule, setCodeRule] = useState<DiscountRule | null>(null);
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set(menu.items.filter((i) => i.soldOut).map((i) => i.id)));
  const [wait, setWait] = useState(waitInitial);
  const [activeCat, setActiveCat] = useState(menu.categories[0]?.key ?? "");
  const [pop, setPop] = useState(false);
  const [pending, startTransition] = useTransition();
  const [placeError, setPlaceError] = useState<string | null>(null);
  // Spaarpunten (1 punt = 1 cent): null = nog niet geladen. Standaard aan als je ze hebt.
  const [points, setPoints] = useState<{ loggedIn: boolean; balance: number; perEuro: number } | null>(null);
  const [usePoints, setUsePoints] = useState(true);
  const spyLock = useRef(0);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const nm = useCallback((it: MenuItemView) => (lang === "nl" ? it.name : it.nameEn), [lang]);
  const ds = (it: MenuItemView) => (lang === "nl" ? it.description : it.descriptionEn) ?? "";
  const fmt = (n: number) => formatEuro(n, lang);
  const lookup: ItemLookup = useCallback(
    (id) => {
      const it = menu.byId[id];
      return it ? { id, price: it.price, category: it.category, flow: it.flow, ingredientCount: it.ingredients.length, soldOut: soldOut.has(id), enabled: it.enabled } : undefined;
    },
    [menu, soldOut],
  );
  const isOut = useCallback((id: string) => soldOut.has(id) || !menu.byId[id], [soldOut, menu]);
  const basket = session.basket;
  const tb = session.mode === "TABLE";

  // Entree via QR: tafel/bar uit de URL overnemen en op welkom beginnen.
  useEffect(() => {
    if (!ready || !entry || "invalidTable" in entry) return;
    if (session.mode !== entry.mode || (entry.mode === "TABLE" && session.table !== entry.table)) {
      setSession({ mode: entry.mode, table: entry.table });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, entry?.toString()]);

  // Kortingscode uit de sessie opnieuw valideren.
  useEffect(() => {
    if (!ready || !session.code) return;
    void checkDiscountCode(session.code).then((r) => {
      if (r.ok) setCodeRule({ type: r.type, value: r.value });
      else setSession({ code: null });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    void getMyFoodPoints().then(setPoints);
  }, []);

  // Live: uitverkocht + wachttijd elke 15s.
  useEffect(() => {
    const id = setInterval(() => {
      void getMenuState().then((s) => {
        setSoldOut(new Set(s.soldOut));
        setWait(s.waitMinutes);
      });
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };
  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const popBar = () => {
    setPop(true);
    setTimeout(() => setPop(false), 400);
  };

  // ---- mand-acties
  function startAdd(id: string, removed: number[] = []) {
    const it = menu.byId[id];
    if (!it || isOut(id)) return;
    const avail = {
      fries: ["friet-k", "friet-m", "friet-g"].some((x) => !isOut(x)),
      sauce: menu.items.some((x) => x.category === "sauzen" && !isOut(x.id)),
      drink: menu.items.some((x) => x.category === "drank" && !isOut(x.id)),
    };
    const steps = stepsFor(it.flow as FlowKey | null, avail);
    if (steps.length) setSheet({ type: "combo", id, removed, steps, i: 0, fries: null, sauces: [], drink: null });
    else {
      setSession((s) => ({ basket: addLooseLine(s.basket, id, removed) }));
      showToast(t("added", { x: nm(it) }));
      popBar();
      setSheet(null);
    }
  }
  function comboNext(s: SheetCombo) {
    const it = menu.byId[s.id];
    const i = nextStepIndex(s, (it?.flow as FlowKey | null) ?? null, s.steps, s.i);
    if (i >= s.steps.length) {
      setSession((sess) => {
        let seq = sess.gseq;
        const next = addCombo(sess.basket, { id: s.id, removed: s.removed, fries: s.fries, sauces: s.sauces, drink: s.drink }, () => `g${++seq}`);
        return { basket: next, gseq: seq };
      });
      showToast(t("added", { x: it ? nm(it) : "" }));
      popBar();
      setSheet(null);
    } else setSheet({ ...s, i });
  }
  function customDone(s: SheetCustom) {
    if (s.lineIdx !== null) {
      setSession((sess) => ({ basket: setLineRemoved(sess.basket, s.lineIdx!, s.removed) }));
      setSheet(null);
    } else startAdd(s.id, s.removed);
  }
  function reorder(i: number) {
    const h = session.history[i];
    if (!h) return;
    const skipped: string[] = [];
    let seq = session.gseq;
    let next = basket;
    const grp: Record<string, BasketLine[]> = {};
    const loose: BasketLine[] = [];
    for (const l of h.lines) {
      const it = menu.byId[l.id];
      if (!it || isOut(l.id)) {
        skipped.push(it ? nm(it) : l.id);
        continue;
      }
      const n: BasketLine = { id: l.id, qty: l.qty, removed: (l.removed ?? []).filter((k) => k < it.ingredients.length), g: null, role: null };
      if (l.g) {
        n.role = l.role;
        (grp[l.g] ??= []).push(n);
      } else loose.push(n);
    }
    for (const ls of Object.values(grp)) {
      if (ls.length < 2 || !ls.some((x) => x.role === "main")) {
        for (const x of ls) {
          x.role = null;
          loose.push(x);
        }
        continue;
      }
      const g = `g${++seq}`;
      for (const x of ls) x.g = g;
      const sig = groupSig(ls);
      const ex = groupsOf(next).find((gl) => groupSig(gl) === sig);
      if (ex) next = next.map((x) => (ex.includes(x) ? { ...x, qty: x.qty + ls[0].qty } : x));
      else next = [...next, ...ls];
    }
    for (const n of loose) {
      const k = lineKey(n);
      const idx = next.findIndex((x) => !x.g && lineKey(x) === k);
      if (idx > -1) next = next.map((x, j) => (j === idx ? { ...x, qty: x.qty + n.qty } : x));
      else next = [...next, n];
    }
    setSession({ basket: next, gseq: seq });
    setSheet(null);
    popBar();
    showToast(skipped.length ? t("reorderSkip", { x: skipped.join(", ") }) : t("reorderDone"));
  }

  // ---- totalen
  const sub = basketTotal(basket, lookup);
  const sav = basketSavings(basket, lookup);
  const disc = discountAmount(sub, codeRule);
  const afterCode = round2(sub - disc);
  const pts = usePoints && points?.loggedIn ? pointsToApply(afterCode, points.balance) : { points: 0, euro: 0 };
  const due = round2(afterCode - pts.euro);
  const covered = due <= 0;
  const earn = points?.loggedIn ? Math.floor(round2(due * points.perEuro)) : 0;
  const loginCallback = tb && session.table ? `/bestellen?tafel=${session.table}` : "/bestellen?modus=bar";
  const count = basketCount(basket);
  const blockedDrinks = drinksOnly(basket, lookup);
  const blockedSold = hasSoldOut(basket, lookup);

  // ---- code
  async function applyCode() {
    const c = normalizeCode(codeIn);
    if (!c) return;
    const r = await checkDiscountCode(c);
    if (r.ok) {
      setSession({ code: r.code });
      setCodeRule({ type: r.type, value: r.value });
      setCodeIn("");
      setCodeErr(false);
      showToast(t("codeApplied"));
    } else setCodeErr(true);
  }
  const codeLabel = codeRule ? (codeRule.type === "PCT" ? `${codeRule.value}%` : fmt(codeRule.value)) : "";

  // ---- plaatsen
  function place(atBar: boolean) {
    if (blockedDrinks || blockedSold || basket.length === 0) return;
    setPlaceError(null);
    startTransition(async () => {
      const r = await placeFoodOrder({
        mode: session.mode,
        table: tb ? session.table : null,
        name: tb ? null : session.name,
        basket,
        note: session.note,
        code: session.code,
        tip: atBar ? 0 : tip,
        payment: atBar ? "BAR" : "ONLINE",
        method: atBar ? null : method,
        locale: lang,
        usePoints: usePoints && !!points?.loggedIn,
      });
      if ("error" in r) {
        setPlaceError(r.error);
        if (r.code === "sold-out") {
          const s = await getMenuState();
          setSoldOut(new Set(s.soldOut));
          go("overview");
        }
        if (r.code === "code") {
          setSession({ code: null });
          setCodeRule(null);
        }
        if (r.code === "points") setPoints(await getMyFoodPoints());
        return;
      }
      const spent = pts.points;
      setPoints((p) => (p ? { ...p, balance: Math.max(0, p.balance - spent) } : p));
      setSession((s) => ({
        myOrders: [...s.myOrders, { id: r.orderId, token: r.accessToken, number: r.number, at: Date.now() }].slice(-10),
        history: [{ number: r.number, at: Date.now(), lines: basket, total: afterCode }, ...s.history].slice(0, 5),
        basket: [],
        note: "",
        code: null,
      }));
      setCodeRule(null);
      setTip(0);
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl.startsWith("http") ? r.checkoutUrl : `/${lang}${r.checkoutUrl.replace(/^\/(nl|en)/, "")}`;
      } else {
        router.push({ pathname: `/bestellen/status/${r.orderId}`, query: { t: r.accessToken } });
      }
    });
  }

  // ---- scroll-spy op het menu
  useEffect(() => {
    if (screen !== "menu") return;
    const onScroll = () => {
      if (Date.now() < spyLock.current) return;
      const tabs = tabsRef.current;
      const secs = [...document.querySelectorAll<HTMLElement>("[data-cat-sec]")];
      if (!tabs || !secs.length) return;
      const line = tabs.getBoundingClientRect().bottom + 2;
      let cur = secs[0].dataset.catSec!;
      for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s.dataset.catSec!;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = secs[secs.length - 1].dataset.catSec!;
      setActiveCat(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [screen]);
  useEffect(() => {
    const tabs = tabsRef.current;
    const b = tabs?.querySelector<HTMLElement>(`[data-tab="${activeCat}"]`);
    if (tabs && b) tabs.scrollTo({ left: b.offsetLeft - (tabs.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
  }, [activeCat]);
  function scrollToCat(key: string) {
    const sec = document.querySelector<HTMLElement>(`[data-cat-sec="${key}"]`);
    const tabs = tabsRef.current;
    if (!sec || !tabs) return;
    spyLock.current = Date.now() + 800;
    setActiveCat(key);
    const off = 56 + tabs.offsetHeight;
    window.scrollTo({ top: Math.max(0, sec.getBoundingClientRect().top + window.scrollY - off + 1), behavior: "smooth" });
  }

  const changeLang = (l: "nl" | "en") => {
    const query = tb && session.table ? { tafel: String(session.table) } : session.mode === "BAR" ? { modus: "bar" } : {};
    router.replace({ pathname: "/bestellen", query }, { locale: l });
  };
  const lastOrder = session.myOrders[session.myOrders.length - 1] ?? null;

  if (!ready) return <div className="min-h-screen bg-white" />;

  // ---- geen QR en geen eerdere tafel: scan-uitleg
  if ((!entry || "invalidTable" in entry) && !session.table && session.mode === "TABLE") {
    return (
      <div className="min-h-screen bg-white">
        <TopBar onBack={null} lang={lang} onLang={changeLang} />
        <div className="mx-auto max-w-[440px] px-5 py-10 text-center">
          <h1 className="text-2xl font-bold">{t("scanTitle")}</h1>
          <p className="mt-2 text-[var(--ink-2)]">{entry && "invalidTable" in entry ? t("invalidTable") : t("scanHint")}</p>
          <div className="mt-6"><Btn variant="ghost" onClick={() => setSession({ mode: "BAR", table: 0 })}>{t("wTitleB")}</Btn></div>
        </div>
      </div>
    );
  }

  const maxW = screen === "menu" ? "max-w-[440px] sm:max-w-[800px] xl:max-w-[1100px]" : "max-w-[440px] sm:max-w-[620px]";

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar onBack={screen === "welcome" ? null : () => go(screen === "pay" ? "overview" : screen === "overview" ? "menu" : "welcome")} lang={lang} onLang={changeLang} />
      <div className={`mx-auto ${maxW}`}>
        {screen === "welcome" && (
          <Welcome
            t={t}
            tb={tb}
            table={session.table}
            name={session.name}
            nameErr={nameErr}
            wait={wait}
            onName={(v) => {
              setSession({ name: v.slice(0, NAME_MAX) });
              if (nameErr && v.trim()) setNameErr(false);
            }}
            onStart={() => {
              if (!tb && !session.name.trim()) {
                setNameErr(true);
                return;
              }
              setSession({ name: session.name.trim() });
              go("menu");
            }}
          />
        )}

        {screen === "menu" && (
          <div>
            {lastOrder && (
              <button type="button" onClick={() => router.push({ pathname: `/bestellen/status/${lastOrder.id}`, query: { t: lastOrder.token } })} className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-left text-sm text-white">
                <span className="size-2 rounded-full bg-[var(--green)] pulse" />
                <span className="flex-1">{t("banner", { no: lastOrder.number })}</span>
                <small className="opacity-70">{t("bannerView")} ›</small>
              </button>
            )}
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wash)] px-3 py-1 text-[13px] font-semibold">
                {tb ? <Table2 className="size-4" /> : <Bell className="size-4" />}
                {tb ? t("ctxT", { n: session.table }) : t("ctxB", { name: session.name })}
              </span>
              <small className="text-xs text-[var(--ink-2)]">{t(tb ? "ctxHintT" : "ctxHintB")} · {t("waitShort", { n: wait })}</small>
            </div>
            {session.history[0] && (
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{t("reorderTitle")}</b>
                  <span className="block truncate text-xs text-[var(--ink-2)]">
                    {session.history[0].lines.map((l) => { const it = menu.byId[l.id]; return it ? `${l.qty > 1 ? l.qty + "× " : ""}${nm(it)}` : ""; }).filter(Boolean).join(", ")} · {fmt(session.history[0].total)}
                  </span>
                  {session.history.length > 1 && (
                    <button type="button" onClick={() => setSheet({ type: "history" })} className="mt-0.5 text-xs font-semibold text-[var(--red-dark)]">{t("reorderAll", { n: session.history.length })}</button>
                  )}
                </div>
                <button type="button" onClick={() => reorder(0)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--wash)]">
                  <RefreshCw className="size-3.5" /> {t("reorderBtn")}
                </button>
              </div>
            )}
            <nav ref={tabsRef} className="no-scrollbar sticky top-14 z-30 mt-3 flex gap-1 overflow-x-auto border-b border-[var(--line)] bg-white px-3 py-2" role="tablist">
              {menu.categories.map((c) => (
                <button key={c.key} type="button" role="tab" data-tab={c.key} aria-selected={activeCat === c.key} onClick={() => scrollToCat(c.key)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${activeCat === c.key ? "bg-[var(--ink)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--wash)]"}`}>
                  {lang === "nl" ? c.name : c.nameEn}
                </button>
              ))}
            </nav>
            {menu.categories.map((c, k) => {
              const list = menu.items.filter((i) => i.category === c.key);
              return (
                <section key={c.key} data-cat-sec={c.key} className={`px-4 pt-5 ${k === menu.categories.length - 1 ? "min-h-[70vh]" : ""}`}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-xl font-bold">{lang === "nl" ? c.name : c.nameEn}</h2>
                    <span className="text-xs text-[var(--ink-3)]">{list.length} items</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((it) => (
                      <MenuCard key={it.id} it={it} out={isOut(it.id)} t={t} nm={nm} ds={ds} fmt={fmt} onAdd={() => startAdd(it.id)} onInfo={() => setSheet({ type: "info", id: it.id })} onCustom={() => setSheet({ type: "custom", id: it.id, removed: [], lineIdx: null })} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {screen === "overview" && (
          <div className="px-4 pt-5">
            <h1 className="text-2xl font-bold">{t("ovTitle")}</h1>
            {basket.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
                <p className="text-[var(--ink-2)]">{t("empty")}</p>
                <div className="mt-4"><Btn variant="ghost" onClick={() => go("menu")}>{t("backMenu")}</Btn></div>
              </div>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--wash)] px-4 py-3">
                  {tb ? <Table2 className="size-5 text-[var(--ink-2)]" /> : <Bell className="size-5 text-[var(--ink-2)]" />}
                  <div>
                    <small className="block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-3)]">{t(tb ? "deliverT" : "deliverB")}</small>
                    <b>{tb ? t("tableN", { n: session.table }) : session.name}</b>
                  </div>
                </div>
                <BasketRows basket={basket} menu={menu} lang={lang} lookup={lookup} isOut={isOut} t={t} fmt={fmt} onInc={(i) => setSession((s) => ({ basket: changeQty(s.basket, i, 1) }))} onDec={(i) => setSession((s) => ({ basket: changeQty(s.basket, i, -1) }))} onRm={(i) => setSession((s) => ({ basket: removeLine(s.basket, i) }))} onEdit={(i) => setSheet({ type: "custom", id: basket[i].id, removed: [...basket[i].removed], lineIdx: i })} />
                <button type="button" onClick={() => go("menu")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--red-dark)]"><Plus className="size-4" /> {t("addMore")}</button>
                <div className="mt-5">
                  <label htmlFor="noteIn" className="text-sm font-semibold">{t("noteLabel")}</label>
                  <textarea id="noteIn" value={session.note} maxLength={NOTE_MAX} onChange={(e) => setSession({ note: e.target.value.slice(0, NOTE_MAX) })} placeholder={t("notePh")} rows={2} className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm" />
                  <div className="flex items-center justify-between text-xs text-[var(--ink-3)]"><span>{t("noteHint")}</span><span>{session.note.length}/{NOTE_MAX}</span></div>
                </div>
                <div className="mt-5 space-y-1 rounded-xl border border-[var(--line)] p-4 text-sm">
                  {sav > 0 && <div className="font-semibold text-[var(--green)]">{t("menuSavings", { amt: fmt(sav) })}</div>}
                  {((session.code && codeRule) || pts.points > 0) && <div className="flex justify-between"><span>{t("sumOrder")}</span><span className="tabular-nums">{fmt(sub)}</span></div>}
                  {session.code && codeRule && <div className="flex justify-between"><span>{t("sumDisc")} · {session.code}</span><span className="tabular-nums">- {fmt(disc)}</span></div>}
                  {pts.points > 0 && <div className="flex justify-between text-[var(--green)]"><span>{t("sumPoints")} · {pts.points}</span><span className="tabular-nums">- {fmt(pts.euro)}</span></div>}
                  <div className="flex items-baseline justify-between"><b>{t("total")}</b><span className="display text-2xl font-extrabold tabular-nums">{fmt(due)}</span></div>
                  <small className="text-xs text-[var(--ink-3)]">{t("vat")}</small>
                </div>
                <div className="mt-5 space-y-2">
                  {(blockedDrinks || blockedSold) && (
                    <div className="flex items-start gap-2 rounded-xl bg-[var(--amber-soft)] p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0" /><span>{t(blockedSold ? "soldOutBlock" : "blockMsg")}</span></div>
                  )}
                  <Btn onClick={() => go("pay")} disabled={blockedDrinks || blockedSold}>{t("toPay")}</Btn>
                  <p className="text-center text-xs text-[var(--ink-3)]">{t("noCancel")}</p>
                </div>
              </>
            )}
          </div>
        )}

        {screen === "pay" && (
          <div className="px-4 pt-5">
            <h1 className="text-2xl font-bold">{t("payTitle")}</h1>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--ink)] px-5 py-4 text-white">
              <div>
                <small className="block text-[11px] font-bold uppercase tracking-[.12em] text-white/60">{t("toPayLbl")}</small>
                <b className="display text-3xl font-extrabold tabular-nums">{fmt(due + tip)}</b>
              </div>
              <div className="text-right text-sm text-white/80">
                {count === 1 ? t("items1") : t("itemsN", { n: count })}
                <br />
                {tb ? t("tableN", { n: session.table }) : session.name}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-[var(--line)]">
              <button type="button" onClick={() => setPayOpen((v) => !v)} aria-expanded={payOpen} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold"><Utensils className="size-4" /> {t("payLines")}<span className="ml-auto">{payOpen ? "▾" : "›"}</span></button>
              {payOpen && (
                <div className="border-t border-[var(--line)] px-4 py-2">
                  <ReadRows basket={basket} menu={menu} lang={lang} lookup={lookup} t={t} fmt={fmt} />
                  <button type="button" onClick={() => go("overview")} className="my-2 text-xs font-semibold text-[var(--red-dark)]">{t("payEdit")}</button>
                </div>
              )}
            </div>

            <div className="mt-4">
              {session.code && codeRule ? (
                <>
                  <Eyebrow>{t("codeLabel")}</Eyebrow>
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-[var(--green-soft)] px-3 py-2 text-sm text-[var(--green)]"><Check className="size-4" /><span className="flex-1 font-semibold">{t("codeOk", { code: session.code, d: codeLabel })}</span><button type="button" onClick={() => { setSession({ code: null }); setCodeRule(null); setCodeOpen(false); }} className="text-xs underline">{t("codeRemove")}</button></div>
                </>
              ) : codeOpen ? (
                <>
                  <Eyebrow>{t("codeLabel")}</Eyebrow>
                  <div className="mt-1 flex gap-2">
                    <input value={codeIn} onChange={(e) => setCodeIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCode())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={20} aria-label={t("codeLabel")} className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm uppercase" />
                    <button type="button" onClick={applyCode} className="rounded-xl border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[var(--wash)]">{t("codeApply")}</button>
                  </div>
                  {codeErr && <span className="mt-1 block text-xs text-[var(--red-dark)]">{t("codeErr")}</span>}
                </>
              ) : (
                <button type="button" onClick={() => setCodeOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--red-dark)]"><Plus className="size-4" /> {t("codeToggle")}</button>
              )}
            </div>

            {points && (
              <div className="mt-4">
                <Eyebrow>{t("pointsLabel")}</Eyebrow>
                {!points.loggedIn ? (
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-[var(--card)] px-3 py-2.5 text-sm ring-1 ring-[var(--line)]">
                    <Coins className="size-4 shrink-0 text-[var(--ink-2)]" />
                    <span className="flex-1 text-[var(--ink-2)]">{t("pointsGuest")}</span>
                    <Link href={{ pathname: "/login", query: { callbackUrl: loginCallback } }} className="shrink-0 text-xs font-semibold text-[var(--red-dark)] underline">{t("pointsLogin")}</Link>
                  </div>
                ) : points.balance <= 0 ? (
                  <p className="mt-1 text-sm text-[var(--ink-2)]">{t("pointsNone")}</p>
                ) : (
                  <button type="button" role="switch" aria-checked={usePoints} onClick={() => setUsePoints((v) => !v)} className={`mt-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${usePoints ? "border-[var(--green)] bg-[var(--green-soft)]" : "border-[var(--line)] bg-[var(--card)]"}`}>
                    <Coins className="size-5 shrink-0 text-[var(--green)]" />
                    <span className="flex-1 text-sm font-semibold">
                      {t("pointsUse")}
                      <small className="block text-xs font-normal text-[var(--ink-2)]">{usePoints && pts.points > 0 ? t("pointsUseSub", { n: pts.points, amt: fmt(pts.euro) }) : t("pointsHave", { n: points.balance, amt: fmt(points.balance / 100) })}</small>
                    </span>
                    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${usePoints ? "bg-[var(--green)]" : "bg-[var(--line)]"}`}>
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${usePoints ? "left-[18px]" : "left-0.5"}`} />
                    </span>
                  </button>
                )}
                {covered && pts.points > 0 && <p className="mt-1.5 text-xs font-semibold text-[var(--green)]">{t("pointsCovered")}</p>}
                {earn > 0 && <p className="mt-1.5 text-xs text-[var(--ink-2)]">{t("pointsEarn", { n: earn })}</p>}
              </div>
            )}

            <div className="mt-5">
              <Eyebrow>{t("tipLabel")}</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
                {TIPS.map((v) => (
                  <Chip key={v} active={tip === v} onClick={() => setTip(v)}>{v === 0 ? t("tipNone") : fmt(v)}</Chip>
                ))}
              </div>
              {(tip || disc || sav || pts.points) > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
                  <span>{t("sumOrder")} {fmt(sub)}</span>
                  {sav > 0 && <span className="font-semibold text-[var(--green)]">{t("youSave", { amt: fmt(sav) })}</span>}
                  {disc > 0 && <span>{t("sumDisc")} - {fmt(disc)}</span>}
                  {pts.points > 0 && <span className="text-[var(--green)]">{t("sumPoints")} - {fmt(pts.euro)}</span>}
                  {tip > 0 && <span>{t("sumTip")} {fmt(tip)}</span>}
                </div>
              )}
            </div>

            {(!covered || tip > 0) && (
              <div className="mt-5" role="radiogroup" aria-label={t("payHow")}>
                <Eyebrow>{t("payHow")}</Eyebrow>
                <div className="mt-2 space-y-2">
                  {METHODS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${method === m.id ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)]"}`}>
                      <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold text-white" style={{ background: m.bg }}>{m.short}</span>
                      <span className="flex-1 text-sm font-semibold">{m.name ?? t("card")}<small className="block text-xs font-normal text-[var(--ink-2)]">{t(m.subKey)}</small></span>
                      <span className={`size-4 rounded-full border-2 ${method === m.id ? "border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--line)]"}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--ink-2)]"><Clock className="size-3.5" /> {t("waitPay", { n: wait })}</div>
              {placeError && <div className="rounded-xl bg-[var(--red-soft)] p-3 text-sm text-[var(--red-dark)]">{placeError}</div>}
              {covered && tip === 0 ? (
                <Btn onClick={() => place(false)} disabled={pending || blockedDrinks || blockedSold}><Coins className="size-4" /> {pending ? t("placing") : t("placeFree")}</Btn>
              ) : (
                <>
                  <Btn onClick={() => place(false)} disabled={pending || blockedDrinks || blockedSold}><Lock className="size-4" /> {pending ? t("redirect") : t("payBtn", { amt: fmt(due + tip) })}</Btn>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--ink-3)]"><ShieldCheck className="size-3.5" /> {t("secure")}</div>
                </>
              )}
              {!covered && (
                <>
                  <div className="text-center text-xs text-[var(--ink-3)]">{t("or")}</div>
                  <Btn variant="ghost" onClick={() => place(true)} disabled={pending || blockedDrinks || blockedSold}>{pending ? t("placing") : t("payBar")}</Btn>
                  <p className="text-center text-xs text-[var(--ink-3)]">{t("payBarSub")}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {screen === "menu" && basket.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[600px] px-3 pb-3">
          {blockedDrinks && <div className="mb-2 flex items-start gap-2 rounded-xl bg-[var(--amber-soft)] px-3 py-2 text-xs shadow"><Info className="mt-0.5 size-3.5 shrink-0" /><span>{t("drinksOnly")}</span></div>}
          <button type="button" onClick={() => go("overview")} className={`btn-grad flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-white shadow-[0_10px_26px_rgba(197,26,37,.35)] ${pop ? "pop" : ""}`}>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{count}</span>
            <span className="flex-1 font-semibold">{t("viewOrder")}</span>
            <span className="font-bold tabular-nums">{fmt(sub)}</span>
          </button>
        </div>
      )}

      <FoodSheets sheet={sheet} onClose={() => setSheet(null)} setSheet={setSheet} menu={menu} lang={lang} lookup={lookup} isOut={isOut} history={session.history} onComboNext={comboNext} onCustomDone={customDone} onReorder={reorder} />
      <Toast msg={toast} />
    </div>
  );
}

// ---------------------------------------------------------------- deelcomponenten

type T = ReturnType<typeof useTranslations<"food">>;

function Welcome({ t, tb, table, name, nameErr, wait, onName, onStart }: { t: T; tb: boolean; table: number; name: string; nameErr: boolean; wait: number; onName: (v: string) => void; onStart: () => void }) {
  return (
    <div>
      <section className="relative bg-[var(--ink)] px-5 pb-8 pt-8 text-white">
        <div className="absolute right-5 top-5 flex flex-col items-center rounded-xl bg-white px-3 py-1.5 text-[var(--ink)]">
          <small className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">{tb ? t("tableWord") : "QR"}</small>
          <span className="display text-2xl font-extrabold leading-none">{tb ? table : t("barWord")}</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[.12em] text-white/60">{t(tb ? "wEyebrowT" : "wEyebrowB")}</span>
        <h1 className="mt-2 max-w-[70%] text-3xl font-extrabold leading-tight">{t(tb ? "wTitleT" : "wTitleB", { n: table })}</h1>
        <p className="mt-2 max-w-[80%] text-white/80">{t(tb ? "wSubT" : "wSubB")}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Clock className="size-3.5" /> {t("waitNow", { n: wait })}</span>
      </section>
      <div className="px-5 py-6">
        <ol className="space-y-4">
          {[
            [t("s1"), t("s1d")],
            [t("s2"), t("s2d")],
            [t(tb ? "s3T" : "s3B"), t(tb ? "s3dT" : "s3dB", { n: table })],
          ].map(([h, d], i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--red-soft)] text-sm font-extrabold text-[var(--red-dark)]">{i + 1}</span>
              <div><b className="block">{h}</b><span className="text-sm text-[var(--ink-2)]">{d}</span></div>
            </li>
          ))}
        </ol>
        {!tb && (
          <div className="mt-6">
            <label htmlFor="nameIn" className="text-sm font-semibold">{t("nameLabel")}</label>
            <input id="nameIn" value={name} onChange={(e) => onName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onStart()} autoComplete="given-name" maxLength={NAME_MAX} placeholder={t("namePh")} className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-base ${nameErr ? "border-[var(--red)]" : "border-[var(--line)]"}`} />
            {nameErr && <span className="mt-1 block text-xs text-[var(--red-dark)]">{t("nameErr")}</span>}
          </div>
        )}
        <div className="mt-6"><Btn onClick={onStart}>{t("start")}</Btn></div>
        {tb && <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--wash)] p-3 text-xs text-[var(--ink-2)]"><Utensils className="mt-0.5 size-4 shrink-0" />{t("clearNote")}</div>}
      </div>
    </div>
  );
}

function MenuCard({ it, out, t, nm, ds, fmt, onAdd, onInfo, onCustom }: { it: MenuItemView; out: boolean; t: T; nm: (i: MenuItemView) => string; ds: (i: MenuItemView) => string; fmt: (n: number) => string; onAdd: () => void; onInfo: () => void; onCustom: () => void }) {
  const lang = nm(it) === it.nameEn && it.name !== it.nameEn ? "en" : "nl";
  const tag = lang === "en" ? it.tagEn : it.tag;
  return (
    <article className={`card-frame relative flex gap-3 rounded-2xl bg-white p-3 ${out ? "opacity-60" : ""}`}>
      {(out || tag) && (
        <span className={`absolute -left-1 -top-2 z-10 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${out ? "bg-[var(--ink-3)]" : "bg-[var(--red)]"}`}>{out ? t("soldOut") : tag}</span>
      )}
      <div className="w-24 shrink-0 sm:w-28"><ItemArt item={it} /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-[15px] font-bold leading-tight">{nm(it)}</h3>
        <p className="mt-1 text-[13px] leading-snug text-[var(--ink-2)]">{ds(it)}</p>
        {it.category !== "drank" && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {it.veg && <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 font-bold text-[var(--green)]">{t("vega")}</span>}
            <Spice n={it.spice} label={it.spice ? t("spiceLbl", { lbl: t(`spice${it.spice}` as "spice1"), n: it.spice, max: 4 }) : undefined} />
            <button type="button" onClick={onInfo} className="inline-flex items-center gap-1 text-[var(--ink-2)] underline-offset-2 hover:underline"><Info className="size-3.5" /> {t("alLink")}</button>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[15px] font-bold tabular-nums">{fmt(it.price)}</span>
          <div className="flex items-center gap-1.5">
            {it.ingredients.length > 0 && !out && (
              <button type="button" onClick={onCustom} aria-label={`${t("editTitle")}: ${nm(it)}`} className="flex size-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--wash)]"><Pencil className="size-4" /></button>
            )}
            <button type="button" onClick={onAdd} disabled={out} aria-label={`${nm(it)} +`} className="btn-grad flex size-9 items-center justify-center rounded-full disabled:opacity-40"><Plus className="size-5" strokeWidth={2.8} /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function BasketRows({ basket, menu, lang, lookup, isOut, t, fmt, onInc, onDec, onRm, onEdit }: { basket: BasketLine[]; menu: MenuData; lang: string; lookup: ItemLookup; isOut: (id: string) => boolean; t: T; fmt: (n: number) => string; onInc: (i: number) => void; onDec: (i: number) => void; onRm: (i: number) => void; onEdit: (i: number) => void }) {
  const nm = (it: MenuItemView) => (lang === "nl" ? it.name : it.nameEn);
  const details = (l: BasketLine, it: MenuItemView) => (l.removed.length ? <span className="block text-xs text-[var(--red-dark)]">{l.removed.map((i) => `${t("without")} ${(lang === "nl" ? it.ingredients[i]?.nl : it.ingredients[i]?.en)?.toLowerCase() ?? ""}`).join(", ")}</span> : null);
  const Main = ({ l, i }: { l: BasketLine; i: number }) => {
    const it = menu.byId[l.id];
    if (!it) return null;
    return (
      <div className="flex gap-3 py-3">
        <ItemArt item={it} size="sm" />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{nm(it)}</span>
          {details(l, it)}
          {isOut(l.id) && <span className="block text-xs font-semibold text-[var(--red-dark)]">{t("soldOutLine")}</span>}
          <div className="mt-2 flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-[var(--line)]">
              <button type="button" onClick={() => onDec(i)} aria-label="-" className="flex size-8 items-center justify-center"><Minus className="size-4" /></button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{l.qty}</span>
              <button type="button" onClick={() => onInc(i)} aria-label="+" className="flex size-8 items-center justify-center"><Plus className="size-4" /></button>
            </div>
            {it.ingredients.length > 0 && <button type="button" onClick={() => onEdit(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-2)]"><Pencil className="size-3.5" /> {t("change")}</button>}
          </div>
        </div>
        <span className="text-sm font-bold tabular-nums">{fmt(linePrice(l, basket, lookup) * l.qty)}</span>
      </div>
    );
  };
  const Sub = ({ l, i }: { l: BasketLine; i: number }) => {
    const it = menu.byId[l.id];
    if (!it) return null;
    const d = unitDeal(l, basket, lookup);
    const p = linePrice(l, basket, lookup);
    return (
      <div className="flex gap-3 border-t border-dashed border-[var(--line)] py-2.5 pl-6">
        <ItemArt item={it} size="sm" />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{nm(it)}{l.qty > 1 && <span className="text-[var(--ink-3)]"> × {l.qty}</span>}</span>
          <span className="block text-xs text-[var(--ink-3)]">{t("kWithMenu")}{d ? <> · <span className="font-semibold text-[var(--green)]">{p === 0 ? t("free") : t("deal", { amt: fmt(d * l.qty) })}</span></> : null}</span>
          {isOut(l.id) && <span className="block text-xs font-semibold text-[var(--red-dark)]">{t("soldOutLine")}</span>}
          <button type="button" onClick={() => onRm(i)} className="mt-1 text-xs font-semibold text-[var(--ink-2)] underline-offset-2 hover:underline">{t("remove")}</button>
        </div>
        <span className="text-right text-sm tabular-nums">{d ? <s className="mr-1 text-xs text-[var(--ink-3)]">{fmt(it.price * l.qty)}</s> : null}<b>{p === 0 ? t("free") : fmt(p * l.qty)}</b></span>
      </div>
    );
  };
  const out: React.ReactNode[] = [];
  const done = new Set<number>();
  basket.forEach((l, i) => {
    if (done.has(i)) return;
    if (!l.g) {
      out.push(<li key={i} className="rounded-xl border border-[var(--line)] px-3"><Main l={l} i={i} /></li>);
      return;
    }
    const idx = basket.map((x, j) => (x.g === l.g ? j : -1)).filter((j) => j > -1);
    idx.forEach((j) => done.add(j));
    const main = idx.find((j) => basket[j].role === "main");
    out.push(
      <li key={i} className="rounded-xl border border-[var(--line)] px-3">
        {main !== undefined && <Main l={basket[main]} i={main} />}
        {idx.filter((j) => j !== main).map((j) => <Sub key={j} l={basket[j]} i={j} />)}
      </li>,
    );
  });
  return <ul className="mt-4 space-y-2">{out}</ul>;
}

function ReadRows({ basket, menu, lang, lookup, t, fmt }: { basket: BasketLine[]; menu: MenuData; lang: string; lookup: ItemLookup; t: T; fmt: (n: number) => string }) {
  const rows: React.ReactNode[] = [];
  const done = new Set<number>();
  const row = (l: BasketLine, sub: boolean, key: number) => {
    const it = menu.byId[l.id];
    if (!it) return null;
    const p = linePrice(l, basket, lookup);
    return (
      <li key={key} className={`flex items-baseline gap-2 py-1 text-sm ${sub ? "pl-6 text-[var(--ink-2)]" : ""}`}>
        <b className="w-7 shrink-0 tabular-nums">{l.qty}×</b>
        <span className="flex-1">{lang === "nl" ? it.name : it.nameEn}{sub && <em className="ml-1 text-xs not-italic text-[var(--ink-3)]">{t("kWithMenu")}</em>}</span>
        <span className="tabular-nums">{p === 0 ? t("free") : fmt(p * l.qty)}</span>
      </li>
    );
  };
  basket.forEach((l, i) => {
    if (done.has(i)) return;
    if (!l.g) {
      rows.push(row(l, false, i));
      return;
    }
    const idx = basket.map((x, j) => (x.g === l.g ? j : -1)).filter((j) => j > -1);
    idx.forEach((j) => done.add(j));
    const main = idx.find((j) => basket[j].role === "main");
    if (main !== undefined) rows.push(row(basket[main], false, main));
    idx.filter((j) => j !== main).forEach((j) => rows.push(row(basket[j], true, j)));
  });
  return <ul>{rows}</ul>;
}
