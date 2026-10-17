/**
 * Winkelmand- en prijsregels van de bestelapp (puur, gedeeld door client en
 * server). Port van unitDeal/linePrice/total/savings/discount en de
 * mand-reducers uit het prototype. De server rekent bij het plaatsen alles
 * opnieuw uit met deze functies; het bedrag van de telefoon wordt nooit vertrouwd.
 */
import { DEAL, type FlowKey, type StepKey, FLOWS } from "./menu-data";

export type LineRole = "main" | "fries" | "sauce" | "drink";

/** Regel in de winkelmand. Regels met dezelfde `g` vormen één combo (menu). */
export interface BasketLine {
  id: string;
  qty: number;
  /** Indexen in item.ingredients die weggehaald zijn. */
  removed: number[];
  g: string | null;
  role: LineRole | null;
}

/** Minimale item-shape die de prijsregels nodig hebben. */
export interface PricedItem {
  id: string;
  price: number;
  category: string; // categoryKey
  flow?: FlowKey | null;
  ingredientCount?: number;
  soldOut?: boolean;
  enabled?: boolean;
}

export type ItemLookup = (id: string) => PricedItem | undefined;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Korting per stuk op een regel in een combo: friet DEAL.fries, drankje DEAL.drink, de eerste sausregel helemaal gratis. */
export function unitDeal(line: BasketLine, basket: BasketLine[], item: ItemLookup): number {
  if (!line.g) return 0;
  if (line.role === "fries") return DEAL.fries;
  if (line.role === "drink") return DEAL.drink;
  if (line.role === "sauce") {
    const first = basket.find((x) => x.g === line.g && x.role === "sauce");
    return first === line ? (item(line.id)?.price ?? 0) : 0;
  }
  return 0;
}

export function linePrice(line: BasketLine, basket: BasketLine[], item: ItemLookup): number {
  return (item(line.id)?.price ?? 0) - unitDeal(line, basket, item);
}

export function basketTotal(basket: BasketLine[], item: ItemLookup): number {
  return round2(basket.reduce((s, l) => s + linePrice(l, basket, item) * l.qty, 0));
}

export function basketSavings(basket: BasketLine[], item: ItemLookup): number {
  return round2(basket.reduce((s, l) => s + unitDeal(l, basket, item) * l.qty, 0));
}

/** Aantal "items": losse regels + hoofdgerechten (onderdelen van een combo tellen niet apart). */
export function basketCount(basket: BasketLine[]): number {
  return basket.reduce((s, l) => s + (!l.g || l.role === "main" ? l.qty : 0), 0);
}

export function hasFood(basket: BasketLine[], item: ItemLookup): boolean {
  return basket.some((l) => {
    const it = item(l.id);
    return it ? !["drank", "sauzen"].includes(it.category) : false;
  });
}

export function drinksOnly(basket: BasketLine[], item: ItemLookup): boolean {
  return basket.length > 0 && !hasFood(basket, item);
}

export function hasSoldOut(basket: BasketLine[], item: ItemLookup): boolean {
  return basket.some((l) => {
    const it = item(l.id);
    return !it || it.soldOut === true || it.enabled === false;
  });
}

export interface DiscountRule {
  type: "PCT" | "EUR";
  value: number;
}

/** Korting op het subtotaal, afgerond op centen, nooit meer dan het subtotaal. Fooi valt erbuiten. */
export function discountAmount(subtotal: number, rule: DiscountRule | null | undefined): number {
  if (!rule || subtotal <= 0) return 0;
  const v = rule.type === "PCT" ? (subtotal * rule.value) / 100 : rule.value;
  return Math.min(subtotal, round2(v));
}

/**
 * Hoeveel spaarpunten er op een bestelling gaan (1 punt = 1 cent): zoveel
 * mogelijk, maar nooit meer dan het saldo of het bedrag na de kortingscode.
 * De fooi valt erbuiten en wordt nooit met punten betaald.
 */
export function pointsToApply(totalAfterCode: number, balance: number): { points: number; euro: number } {
  const cents = Math.max(0, Math.round(totalAfterCode * 100));
  const points = Math.max(0, Math.min(Math.floor(balance), cents));
  return { points, euro: points / 100 };
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Lopende prijs van een combo in de sheet (zelfde regels als unitDeal). */
export function comboPrice(sel: { id: string; fries: string | null; sauces: string[]; drink: string | null }, item: ItemLookup): number {
  let p = item(sel.id)?.price ?? 0;
  if (sel.fries) p += (item(sel.fries)?.price ?? 0) - DEAL.fries;
  if (sel.sauces.length) p += sel.sauces.slice(1).reduce((a, id) => a + (item(id)?.price ?? 0), 0);
  if (sel.drink) p += (item(sel.drink)?.price ?? 0) - DEAL.drink;
  return round2(p);
}

export const lineKey = (l: BasketLine) => JSON.stringify([l.id, [...l.removed].sort((a, b) => a - b)]);
export const groupSig = (ls: BasketLine[]) => JSON.stringify(ls.map((l) => [l.id, l.role, [...l.removed].sort((a, b) => a - b)]));

export function groupsOf(basket: BasketLine[]): BasketLine[][] {
  const m = new Map<string, BasketLine[]>();
  for (const l of basket) {
    if (!l.g) continue;
    if (!m.has(l.g)) m.set(l.g, []);
    m.get(l.g)!.push(l);
  }
  return [...m.values()];
}

/** Los item toevoegen (identieke regel = aantal omhoog). Geeft een nieuwe array terug. */
export function addLooseLine(basket: BasketLine[], id: string, removed: number[] = []): BasketLine[] {
  const l: BasketLine = { id, qty: 1, removed: [...removed], g: null, role: null };
  const k = lineKey(l);
  const next = basket.map((x) => ({ ...x, removed: [...x.removed] }));
  const ex = next.find((x) => !x.g && lineKey(x) === k);
  if (ex) ex.qty++;
  else next.push(l);
  return next;
}

export interface ComboSelection {
  id: string;
  removed: number[];
  fries: string | null;
  sauces: string[];
  drink: string | null;
}

/** Combo toevoegen; zonder onderdelen wordt het een los item. `nextGroupId` levert "g<n>". */
export function addCombo(basket: BasketLine[], sel: ComboSelection, nextGroupId: () => string): BasketLine[] {
  if (!sel.fries && !sel.sauces.length && !sel.drink) return addLooseLine(basket, sel.id, sel.removed);
  const g = nextGroupId();
  const lines: BasketLine[] = [{ id: sel.id, qty: 1, removed: [...sel.removed], g, role: "main" }];
  if (sel.fries) lines.push({ id: sel.fries, qty: 1, removed: [], g, role: "fries" });
  for (const id of sel.sauces) lines.push({ id, qty: 1, removed: [], g, role: "sauce" });
  if (sel.drink) lines.push({ id: sel.drink, qty: 1, removed: [], g, role: "drink" });
  const sig = groupSig(lines);
  const next = basket.map((x) => ({ ...x, removed: [...x.removed] }));
  const ex = groupsOf(next).find((gl) => groupSig(gl) === sig);
  if (ex) ex.forEach((l) => l.qty++);
  else next.push(...lines);
  return next;
}

/** Aantal aanpassen; op een combo geldt het voor alle onderdelen. */
export function changeQty(basket: BasketLine[], index: number, delta: number): BasketLine[] {
  const l = basket[index];
  if (!l) return basket;
  const ids = l.g ? basket.map((x, j) => (x.g === l.g ? j : -1)).filter((j) => j > -1) : [index];
  const next = basket.map((x, j) => (ids.includes(j) ? { ...x, qty: x.qty + delta } : x));
  if (next[index].qty <= 0) return next.filter((_, j) => !ids.includes(j));
  return next;
}

/** Eén onderdeel uit een combo halen; blijft alleen het hoofdgerecht over, dan wordt dat een los item. */
export function removeLine(basket: BasketLine[], index: number): BasketLine[] {
  const l = basket[index];
  if (!l) return basket;
  const next = basket.filter((_, j) => j !== index).map((x) => ({ ...x }));
  if (l.g) {
    const rest = next.filter((x) => x.g === l.g);
    if (rest.length === 1) {
      rest[0].g = null;
      rest[0].role = null;
    }
  }
  return next;
}

/** Ingrediënten van een bestaande regel aanpassen; losse duplicaten samenvoegen. */
export function setLineRemoved(basket: BasketLine[], index: number, removed: number[]): BasketLine[] {
  const next = basket.map((x) => ({ ...x, removed: [...x.removed] }));
  const l = next[index];
  if (!l) return basket;
  l.removed = [...removed];
  if (!l.g) {
    const k = lineKey(l);
    const dup = next.findIndex((x, j) => j !== index && !x.g && lineKey(x) === k);
    if (dup > -1) {
      next[dup].qty += l.qty;
      next.splice(index, 1);
    }
  }
  return next;
}

/**
 * Combo-stappen voor een item: alleen stappen met minstens één beschikbare
 * optie. Bij een burger zonder friet valt de sausstap weg (comboNext).
 */
export function stepsFor(flow: FlowKey | null | undefined, available: Record<StepKey, boolean>): StepKey[] {
  if (!flow) return [];
  return (FLOWS[flow] ?? []).filter((st) => available[st]);
}

export function nextStepIndex(sel: { id: string; fries: string | null }, flow: FlowKey | null | undefined, steps: StepKey[], current: number): number {
  let i = current + 1;
  while (i < steps.length && steps[i] === "sauce" && flow === "burger" && !sel.fries) i++;
  return i;
}

/**
 * Server-side normalisatie + validatie van een mand van de klant. Verwijdert
 * onbekende/uitgeschakelde items, zet groepen zonder hoofdgerecht om naar
 * losse regels (geen menuvoordeel zonder main), begrenst aantallen.
 */
export function sanitizeBasket(raw: unknown, item: ItemLookup): { basket: BasketLine[]; dropped: string[] } {
  const dropped: string[] = [];
  if (!Array.isArray(raw)) return { basket: [], dropped };
  const lines: BasketLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Partial<BasketLine>;
    if (typeof o.id !== "string") continue;
    const it = item(o.id);
    if (!it || it.enabled === false) {
      dropped.push(o.id);
      continue;
    }
    const qty = Math.max(1, Math.min(20, Math.floor(Number(o.qty) || 1)));
    const maxIng = it.ingredientCount ?? 0;
    const removed = Array.isArray(o.removed) ? [...new Set(o.removed.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < maxIng))].sort((a, b) => a - b) : [];
    const role: LineRole | null = o.role === "main" || o.role === "fries" || o.role === "sauce" || o.role === "drink" ? o.role : null;
    const g = typeof o.g === "string" && o.g && role ? o.g.slice(0, 20) : null;
    lines.push({ id: o.id, qty, removed, g, role: g ? role : null });
  }
  // Groepen zonder hoofdgerecht (of zonder onderdelen) → losse regels.
  for (const gl of groupsOf(lines)) {
    const main = gl.find((l) => l.role === "main");
    const ok = main && gl.length >= 2 && gl.every((l) => l.role !== "main" || l === main);
    if (!ok) {
      for (const l of gl) {
        l.g = null;
        l.role = null;
      }
      continue;
    }
    // Invariant: alle regels van een combo hebben hetzelfde aantal (dat van het hoofdgerecht).
    for (const l of gl) l.qty = main!.qty;
  }
  return { basket: lines.slice(0, 60), dropped };
}

/** Collector-nummer ("B·001/006") per item op basis van de categorievolgorde. */
export function collectorNumbers(items: Array<{ id: string; category: string }>, categories: Array<{ key: string; code: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of categories) {
    const list = items.filter((i) => i.category === c.key);
    list.forEach((it, k) => {
      out[it.id] = `${c.code}·${String(k + 1).padStart(3, "0")}/${String(list.length).padStart(3, "0")}`;
    });
  }
  return out;
}

export function formatEuro(n: number, locale = "nl"): string {
  return locale === "nl" ? "€ " + n.toFixed(2).replace(".", ",") : "€" + n.toFixed(2);
}
