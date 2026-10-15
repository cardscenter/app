import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES, DEFAULT_CODES, DEFAULT_ITEMS, WAIT_DEFAULT, WAIT_OPTIONS, type FlowKey } from "./menu-data";
import { collectorNumbers, type PricedItem } from "./pricing";

/**
 * Menu uit de DB (Community Hub, Fase 4). Lazy geseed uit `menu-data.ts`;
 * daarna is de DB leidend (admin bewerkt prijzen/aan-uit, keuken zet
 * uitverkocht). Korte cache zodat gasten en keuken niet per request de
 * menutabellen raken; schrijfpaden maken de cache leeg.
 */

export interface MenuItemView {
  id: string;
  category: string;
  no: string; // collector-nummer
  name: string;
  nameEn: string;
  description: string | null;
  descriptionEn: string | null;
  price: number;
  flow: FlowKey | null;
  veg: boolean;
  spice: number | null;
  tag: string | null;
  tagEn: string | null;
  image: string | null;
  art: string;
  color: string | null;
  allergens: string[];
  ingredients: Array<{ nl: string; en: string }>;
  soldOut: boolean;
  enabled: boolean;
}

export interface MenuCategoryView {
  key: string;
  code: string;
  name: string;
  nameEn: string;
}

export interface MenuView {
  categories: MenuCategoryView[];
  items: MenuItemView[];
  /** Serialiseerbare map voor de client. */
  byId: Record<string, MenuItemView>;
}

let seeded = false;
export async function ensureMenu(): Promise<void> {
  if (seeded) return;
  const count = await prisma.menuCategory.count();
  if (count === 0) {
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      await prisma.menuCategory.upsert({ where: { key: c.key }, create: { ...c, sortOrder: i * 10 }, update: {} });
    }
    for (const [i, it] of DEFAULT_ITEMS.entries()) {
      await prisma.menuItem.upsert({
        where: { id: it.id },
        create: {
          id: it.id,
          categoryKey: it.cat,
          name: it.name.nl,
          nameEn: it.name.en,
          description: it.d.nl,
          descriptionEn: it.d.en,
          price: it.price,
          flow: it.flow ?? null,
          veg: !!it.veg,
          spice: it.spice ?? null,
          tag: it.tag?.nl ?? null,
          tagEn: it.tag?.en ?? null,
          image: it.img ?? null,
          art: it.art,
          color: it.c ?? null,
          allergens: JSON.stringify(it.al),
          ingredients: it.ing ? JSON.stringify(it.ing) : null,
          sortOrder: i,
        },
        update: {},
      });
    }
  }
  const codes = await prisma.discountCode.count();
  if (codes === 0) {
    for (const c of DEFAULT_CODES) await prisma.discountCode.upsert({ where: { code: c.code }, create: c, update: {} });
  }
  seeded = true;
}

const TTL_MS = 10_000;
let cache: { at: number; value: MenuView } | null = null;

export function invalidateMenuCache(): void {
  cache = null;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Volledig menu incl. uitgeschakelde items (admin); gasten filteren op `enabled`. */
export async function getMenu(opts: { includeDisabled?: boolean } = {}): Promise<MenuView> {
  await ensureMenu();
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const [cats, items] = await Promise.all([
      prisma.menuCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.menuItem.findMany({ orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }] }),
    ]);
    const catOrder = new Map(cats.map((c, i) => [c.key, i]));
    const sorted = [...items].sort((a, b) => (catOrder.get(a.categoryKey) ?? 0) - (catOrder.get(b.categoryKey) ?? 0) || a.sortOrder - b.sortOrder);
    const nos = collectorNumbers(
      sorted.filter((i) => i.enabled).map((i) => ({ id: i.id, category: i.categoryKey })),
      cats.map((c) => ({ key: c.key, code: c.code })),
    );
    const views: MenuItemView[] = sorted.map((i) => ({
      id: i.id,
      category: i.categoryKey,
      no: nos[i.id] ?? "",
      name: i.name,
      nameEn: i.nameEn,
      description: i.description,
      descriptionEn: i.descriptionEn,
      price: i.price,
      flow: (i.flow as FlowKey | null) ?? null,
      veg: i.veg,
      spice: i.spice,
      tag: i.tag,
      tagEn: i.tagEn,
      image: i.image,
      art: i.art,
      color: i.color,
      allergens: parseJsonArray<string>(i.allergens),
      ingredients: parseJsonArray<{ nl: string; en: string }>(i.ingredients),
      soldOut: i.soldOut,
      enabled: i.enabled,
    }));
    cache = {
      at: Date.now(),
      value: {
        categories: cats.filter((c) => c.enabled).map((c) => ({ key: c.key, code: c.code, name: c.name, nameEn: c.nameEn })),
        items: views,
        byId: Object.fromEntries(views.map((v) => [v.id, v])),
      },
    };
  }
  const v = cache.value;
  if (opts.includeDisabled) return v;
  const items = v.items.filter((i) => i.enabled && v.categories.some((c) => c.key === i.category));
  return { categories: v.categories, items, byId: Object.fromEntries(items.map((i) => [i.id, i])) };
}

export function toPricedLookup(menu: MenuView): (id: string) => PricedItem | undefined {
  return (id) => {
    const it = menu.byId[id];
    return it ? { id: it.id, price: it.price, category: it.category, flow: it.flow, ingredientCount: it.ingredients.length, soldOut: it.soldOut, enabled: it.enabled } : undefined;
  };
}

// ---------------------------------------------------------------- keuken-instellingen

const WAIT_KEY = "kitchen.waitMinutes";
let waitCache: { at: number; value: number } | null = null;

export async function getWaitMinutes(): Promise<number> {
  if (waitCache && Date.now() - waitCache.at < TTL_MS) return waitCache.value;
  const row = await prisma.appConfig.findUnique({ where: { key: WAIT_KEY } });
  let value = WAIT_DEFAULT;
  if (row) {
    try {
      const n = Number(JSON.parse(row.value));
      if ((WAIT_OPTIONS as readonly number[]).includes(n)) value = n;
    } catch {
      // default
    }
  }
  waitCache = { at: Date.now(), value };
  return value;
}

export async function setWaitMinutes(n: number): Promise<void> {
  if (!(WAIT_OPTIONS as readonly number[]).includes(n)) throw new Error("Ongeldige wachttijd");
  await prisma.appConfig.upsert({ where: { key: WAIT_KEY }, create: { key: WAIT_KEY, value: JSON.stringify(n) }, update: { value: JSON.stringify(n) } });
  waitCache = null;
}

export async function setItemSoldOut(id: string, soldOut: boolean): Promise<void> {
  await prisma.menuItem.update({ where: { id }, data: { soldOut } });
  invalidateMenuCache();
}
