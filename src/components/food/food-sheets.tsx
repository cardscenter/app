"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { MenuItemView } from "@/lib/food/menu-server";
import { ALLERGENS, DEAL, SAUCE_ML } from "@/lib/food/menu-data";
import { comboPrice, formatEuro, type ItemLookup } from "@/lib/food/pricing";
import type { MenuData, Sheet, SheetCombo, SheetCustom, FoodSession } from "./food-types";
import { ArtSvg, ItemArt, ItemPic } from "./menu-art";
import { Btn, Spice } from "./food-ui";

interface Props {
  sheet: Sheet | null;
  onClose: () => void;
  setSheet: (s: Sheet) => void;
  menu: MenuData;
  lang: string;
  lookup: ItemLookup;
  isOut: (id: string) => boolean;
  history: FoodSession["history"];
  onComboNext: (s: SheetCombo) => void;
  onCustomDone: (s: SheetCustom) => void;
  onReorder: (i: number) => void;
}

function Head({ it, title, sub }: { it: MenuItemView; title: string; sub: string }) {
  return (
    <>
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />
      <div className="mb-4 flex items-center gap-3">
        <ItemArt item={it} size="sm" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight text-[var(--ink)]">{title}</h3>
          <p className="text-[13px] text-[var(--ink-2)]">{sub}</p>
        </div>
      </div>
    </>
  );
}

function FriesOption({
  name,
  sub,
  price,
  out,
  selected,
  onSelect,
  dealLabel,
  soldOutLabel,
}: {
  name: string;
  sub: string;
  price: string;
  out?: boolean;
  selected: boolean;
  onSelect: () => void;
  dealLabel: string | null;
  soldOutLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={out}
      onClick={onSelect}
      aria-checked={selected}
      role="radio"
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left disabled:opacity-40 ${selected ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)]"}`}
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold">{name}{dealLabel ? <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--green)]">{dealLabel}</span> : null}</span>
        <small className="block text-xs text-[var(--ink-2)]">{out ? soldOutLabel : sub}</small>
      </span>
      <span className="text-sm font-bold tabular-nums">{price}</span>
    </button>
  );
}

/** Bottom sheets: allergenen (info), ingrediënten (custom), combo-stappen, geschiedenis. */
export function FoodSheets(p: Props) {
  const t = useTranslations("food");
  const { sheet } = p;
  const nm = (it: MenuItemView) => (p.lang === "nl" ? it.name : it.nameEn);
  const fmt = (n: number) => formatEuro(n, p.lang);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet, p]);

  if (!sheet) return null;

  let body: React.ReactNode = null;

  if (sheet.type === "history") {
    body = (
      <>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />
        <h3 className="mb-3 text-lg font-bold">{t("reorderSheet")}</h3>
        <div className="space-y-2">
          {p.history.map((h, i) => (
            <div key={`${h.number}-${h.at}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
              <div className="min-w-0 flex-1">
                <b className="block text-sm">#{h.number} · {new Date(h.at).toLocaleDateString(p.lang === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short" })} {new Date(h.at).toLocaleTimeString(p.lang === "nl" ? "nl-NL" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</b>
                <span className="block truncate text-xs text-[var(--ink-2)]">{h.lines.map((l) => { const it = p.menu.byId[l.id]; return it ? `${l.qty > 1 ? l.qty + "× " : ""}${nm(it)}` : ""; }).filter(Boolean).join(", ")}</span>
              </div>
              <b className="text-sm tabular-nums">{fmt(h.total)}</b>
              <button type="button" onClick={() => p.onReorder(i)} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--wash)]">{t("reorderBtn")}</button>
            </div>
          ))}
        </div>
        <div className="mt-4"><Btn variant="ghost" onClick={p.onClose}>OK</Btn></div>
      </>
    );
  } else {
    const it = p.menu.byId[sheet.id];
    if (!it) return null;

    if (sheet.type === "info") {
      body = (
        <>
          <Head it={it} title={nm(it)} sub={t("alTitle")} />
          {it.spice ? (
            <p className="mb-2 flex items-center gap-2 text-[13px] text-[var(--ink-2)]"><Spice n={it.spice} /> {t(`spice${it.spice}` as "spice1")}</p>
          ) : null}
          <span className="block text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-3)]">{t("contains")}</span>
          {it.allergens.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {it.allergens.map((a) => (
                <span key={a} className="rounded-full bg-[var(--wash)] px-2.5 py-1 text-xs font-semibold">{ALLERGENS[a]?.[p.lang === "nl" ? "nl" : "en"] ?? a}</span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--ink-2)]">{t("alNone")}</p>
          )}
          <p className="mt-4 rounded-xl bg-[var(--amber-soft)] p-3 text-[13px] text-[var(--ink)]">{t("alFryer")}</p>
          <p className="mt-2 text-xs text-[var(--ink-3)]">{t("alProto")}</p>
          <div className="mt-4"><Btn variant="ghost" onClick={p.onClose}>OK</Btn></div>
        </>
      );
    }

    if (sheet.type === "custom") {
      const s = sheet;
      body = (
        <>
          <Head it={it} title={nm(it)} sub={t("editSub")} />
          <div className="space-y-2">
            {it.ingredients.map((g, i) => {
              const on = !s.removed.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => p.setSheet({ ...s, removed: on ? [...s.removed, i] : s.removed.filter((x) => x !== i) })}
                  aria-pressed={on}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${on ? "border-[var(--line)] bg-white" : "border-[var(--red)]/30 bg-[var(--red-soft)] line-through"}`}
                >
                  <span className="font-medium">{p.lang === "nl" ? g.nl : g.en}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${on ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-white text-[var(--red-dark)]"}`}>{on ? t("on") : t("off")}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4"><Btn onClick={() => p.onCustomDone(s)}>{s.lineIdx !== null ? t("save") : t("cont")}</Btn></div>
        </>
      );
    }

    if (sheet.type === "combo") {
      const s = sheet;
      const step = s.steps[s.i];
      const last = s.i === s.steps.length - 1;
      const price = comboPrice({ id: s.id, fries: s.fries, sauces: s.sauces, drink: s.drink }, p.lookup);
      const next = (label: string) => <div className="mt-4"><Btn onClick={() => p.onComboNext(s)}>{label}</Btn></div>;

      if (step === "fries") {
        const fries = ["friet-k", "friet-m", "friet-g"].map((id) => p.menu.byId[id]).filter(Boolean);
        const optProps = (v: string, deal?: number, out?: boolean) => ({
          out,
          selected: (s.fries ?? "none") === v,
          onSelect: () => p.setSheet({ ...s, fries: v === "none" ? null : v }),
          dealLabel: deal && !out ? t("deal", { amt: fmt(deal) }) : null,
          soldOutLabel: t("soldOut"),
        });
        body = (
          <>
            <Head it={it} title={t("friesTitle")} sub={`${nm(it)} · ${t("friesSub")}`} />
            <div className="space-y-2" role="radiogroup">
              <FriesOption {...optProps("none")} name={t("noFries")} sub={fmt(it.price)} price="" />
              {fries.map((f) => (
                <FriesOption key={f.id} {...optProps(f.id, DEAL.fries, p.isOut(f.id))} name={nm(f)} sub={t("loose", { amt: fmt(f.price) })} price={"+ " + fmt(f.price - DEAL.fries)} />
              ))}
            </div>
            {next(t("next"))}
          </>
        );
      } else if (step === "sauce") {
        const sauces = p.menu.items.filter((x) => x.category === "sauzen");
        body = (
          <>
            <Head it={it} title={t("sauceTitle")} sub={t("sauceSub", { ml: SAUCE_ML })} />
            <div className="grid grid-cols-3 gap-2" role="group">
              {sauces.map((d) => {
                const k = s.sauces.indexOf(d.id);
                const out = p.isOut(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={out}
                    role="checkbox"
                    aria-checked={k > -1}
                    onClick={() => p.setSheet({ ...s, sauces: k > -1 ? s.sauces.filter((x) => x !== d.id) : [...s.sauces, d.id] })}
                    className={`flex flex-col items-center rounded-xl border p-2 text-center disabled:opacity-40 ${k > -1 ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)]"}`}
                  >
                    <span className="size-12"><ArtSvg art="dip" color={d.color} /></span>
                    <span className="mt-1 text-xs font-semibold leading-tight">{nm(d)}</span>
                    <small className={`text-[11px] ${k === 0 ? "font-bold text-[var(--green)]" : "text-[var(--ink-2)]"}`}>{out ? t("soldOut") : k === 0 ? t("free") : k > 0 ? "+ " + fmt(d.price) : " "}</small>
                  </button>
                );
              })}
            </div>
            {next(s.sauces.length ? (last ? t("addFor", { amt: fmt(price) }) : t("next")) : last ? t("addFor", { amt: fmt(price) }) : t("noSauce"))}
          </>
        );
      } else if (step === "drink") {
        const drinks = p.menu.items.filter((x) => x.category === "drank");
        body = (
          <>
            <Head it={it} title={t("drinkTitle")} sub={t("drinkSub", { amt: fmt(DEAL.drink) })} />
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto pr-1" role="radiogroup">
              {drinks.map((d) => {
                const out = p.isOut(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={out}
                    role="radio"
                    aria-checked={s.drink === d.id}
                    onClick={() => p.setSheet({ ...s, drink: s.drink === d.id ? null : d.id })}
                    className={`flex flex-col items-center rounded-xl border p-2 text-center disabled:opacity-40 ${s.drink === d.id ? "border-[var(--ink)] ring-1 ring-[var(--ink)]" : "border-[var(--line)]"}`}
                  >
                    <span className="h-16 w-14"><ItemPic item={d} /></span>
                    <span className="mt-1 text-xs font-semibold leading-tight">{nm(d)}</span>
                    <small className="text-[11px] text-[var(--ink-2)]">{out ? t("soldOut") : <><s>{fmt(d.price)}</s> {fmt(d.price - DEAL.drink)}</>}</small>
                  </button>
                );
              })}
            </div>
            {next(t("addFor", { amt: fmt(price) }))}
          </>
        );
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={p.onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="fixed inset-x-0 bottom-0 z-[55] mx-auto max-h-[88vh] w-full max-w-[600px] overflow-y-auto rounded-t-2xl bg-white p-4 pb-6 shadow-2xl">
        {body}
      </div>
    </>
  );
}
