import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createProviderPayment } from "@/lib/mollie";
import { dayKey as shopDayKey, SHOP_TIMEZONE } from "@/lib/shop-events/format";
import { mapProviderStatus, type PaymentStatus } from "@/lib/shop-events/config";
import { getMenu, getWaitMinutes, toPricedLookup, type MenuView } from "./menu-server";
import { FIRST_ORDER_NUMBER, NAME_MAX, NOTE_MAX, TABLE_MAX, TABLE_MIN, TIPS, UNPAID_ONLINE_MINUTES, DEFAULT_ITEMS } from "./menu-data";
import {
  basketSavings,
  basketTotal,
  discountAmount,
  drinksOnly,
  hasSoldOut,
  normalizeCode,
  round2,
  sanitizeBasket,
  type BasketLine,
  type DiscountRule,
} from "./pricing";

/**
 * Bestellingen (Community Hub, Fase 4): plaatsen met server-side herberekening,
 * dagnummers, Mollie-koppeling (purpose FOOD_ORDER), keuken-statusmachine.
 * Gasten hebben geen account: de statuspagina werkt met `accessToken`.
 */

export type OrderStatus = "AWAITING_PAYMENT" | "NEW" | "PREPARING" | "READY" | "DONE" | "PAYMENT_FAILED";
export const KITCHEN_OPEN_STATUSES: OrderStatus[] = ["NEW", "PREPARING", "READY"];

export interface OrderView {
  id: string;
  number: number;
  dayKey: string;
  mode: "TABLE" | "BAR";
  table: number | null;
  name: string | null;
  lines: BasketLine[];
  note: string | null;
  subtotal: number;
  savings: number;
  code: string | null;
  discount: number;
  total: number;
  tip: number;
  payment: "ONLINE" | "BAR";
  method: string | null;
  paid: boolean;
  paidAt: string | null;
  status: OrderStatus;
  waitMinutes: number;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  paymentStatus: string | null;
  checkoutUrl: string | null;
}

type OrderRow = Awaited<ReturnType<typeof loadOrder>>;
async function loadOrder(id: string) {
  return prisma.foodOrder.findUnique({ where: { id }, include: { paymentRef: { select: { status: true, checkoutUrl: true } } } });
}

function parseLines(raw: string): BasketLine[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as BasketLine[]) : [];
  } catch {
    return [];
  }
}

export function toOrderView(o: NonNullable<OrderRow>): OrderView {
  return {
    id: o.id,
    number: o.number,
    dayKey: o.dayKey,
    mode: o.mode as "TABLE" | "BAR",
    table: o.tableNumber,
    name: o.name,
    lines: parseLines(o.lines),
    note: o.note,
    subtotal: o.subtotal,
    savings: o.savings,
    code: o.code,
    discount: o.discount,
    total: o.total,
    tip: o.tip,
    payment: o.payment as "ONLINE" | "BAR",
    method: o.method,
    paid: o.paid,
    paidAt: o.paidAt?.toISOString() ?? null,
    status: o.status as OrderStatus,
    waitMinutes: o.waitMinutes,
    createdAt: o.createdAt.toISOString(),
    startedAt: o.startedAt?.toISOString() ?? null,
    readyAt: o.readyAt?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    paymentStatus: o.paymentRef?.status ?? null,
    checkoutUrl: o.paymentRef?.checkoutUrl ?? null,
  };
}

export const todayKey = (d: Date = new Date()) => shopDayKey(d);

/** Begin van de winkeldag (00:00 Europe/Amsterdam) als UTC-Date. */
export function dayStart(d: Date = new Date()): Date {
  const key = todayKey(d);
  // 00:00 lokale tijd: zoek de UTC-tijd waarvoor de dag-sleutel net omslaat (max 26u terug).
  const guess = new Date(`${key}T00:00:00Z`);
  for (let offsetH = -3; offsetH <= 3; offsetH++) {
    const cand = new Date(guess.getTime() + offsetH * 3600_000);
    const prev = new Date(cand.getTime() - 60_000);
    if (shopDayKey(cand) === key && shopDayKey(prev) !== key) return cand;
  }
  return guess;
}

export function methodLabel(method: string | null | undefined): string | null {
  switch (method) {
    case "ideal":
      return "iDEAL";
    case "bancontact":
      return "Bancontact";
    case "applepay":
      return "Apple Pay";
    case "card":
      return "Creditcard";
    default:
      return method ?? null;
  }
}

// ---------------------------------------------------------------- kortingscodes

export async function resolveDiscountCode(raw: string | null | undefined): Promise<{ code: string; rule: DiscountRule } | null> {
  if (!raw) return null;
  const code = normalizeCode(raw);
  if (!code) return null;
  const row = await prisma.discountCode.findUnique({ where: { code } });
  if (!row || !row.enabled) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  if (row.maxUses !== null && row.uses >= row.maxUses) return null;
  return { code, rule: { type: row.type === "PCT" ? "PCT" : "EUR", value: row.value } };
}

// ---------------------------------------------------------------- plaatsen

export interface PlaceOrderInput {
  mode: "TABLE" | "BAR";
  table?: number | null;
  name?: string | null;
  basket: unknown;
  note?: string | null;
  code?: string | null;
  tip?: number;
  payment: "ONLINE" | "BAR";
  method?: string | null;
  locale: string;
  userId?: string | null;
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; number: number; accessToken: string; checkoutUrl: string | null }
  | { error: string; code?: "drinks-only" | "sold-out" | "empty" | "table" | "name" | "code" | "payment" };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const menu = await getMenu();
  const lookup = toPricedLookup(menu);
  const { basket } = sanitizeBasket(input.basket, lookup);
  if (basket.length === 0) return { error: "Je bestelling is leeg.", code: "empty" };
  if (drinksOnly(basket, lookup)) return { error: "Losse drankjes haal je aan de bar. Voeg iets te eten toe.", code: "drinks-only" };
  if (hasSoldOut(basket, lookup)) return { error: "Iets in je bestelling is net uitverkocht. Haal het weg om verder te gaan.", code: "sold-out" };

  let table: number | null = null;
  let name: string | null = null;
  if (input.mode === "TABLE") {
    table = Number(input.table);
    if (!Number.isInteger(table) || table < TABLE_MIN || table > TABLE_MAX) return { error: "Ongeldig tafelnummer. Scan de QR-code op je tafel opnieuw.", code: "table" };
  } else {
    name = (input.name ?? "").trim().slice(0, NAME_MAX);
    if (!name) return { error: "Vul je naam in, dan weten we wie we moeten roepen.", code: "name" };
  }

  const subtotal = basketTotal(basket, lookup);
  const savings = basketSavings(basket, lookup);
  const codeInfo = await resolveDiscountCode(input.code);
  if (input.code && normalizeCode(input.code) && !codeInfo) return { error: "Deze kortingscode is niet (meer) geldig.", code: "code" };
  const discount = discountAmount(subtotal, codeInfo?.rule ?? null);
  const total = round2(subtotal - discount);
  const tip = input.payment === "ONLINE" && (TIPS as readonly number[]).includes(Number(input.tip)) ? Number(input.tip) : 0;
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX) || null;
  const waitMinutes = await getWaitMinutes();
  const now = new Date();
  const dayKey = todayKey(now);
  const accessToken = randomBytes(18).toString("base64url");
  const locale = input.locale === "en" ? "en" : "nl";
  const online = input.payment === "ONLINE";

  // Dagnummer: max+1 vanaf 101; de unique-index vangt een race, dan opnieuw.
  let created: { id: string; number: number } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const last = await prisma.foodOrder.findFirst({ where: { dayKey }, orderBy: { number: "desc" }, select: { number: true } });
    const number = Math.max(FIRST_ORDER_NUMBER, (last?.number ?? FIRST_ORDER_NUMBER - 1) + 1);
    try {
      const row = await prisma.foodOrder.create({
        data: {
          dayKey,
          number,
          mode: input.mode,
          tableNumber: table,
          name,
          userId: input.userId ?? null,
          locale,
          lines: JSON.stringify(basket),
          note,
          subtotal,
          savings,
          code: codeInfo?.code ?? null,
          discount,
          total,
          tip,
          payment: input.payment,
          method: online ? methodLabel(input.method) : null,
          paid: false,
          status: online ? "AWAITING_PAYMENT" : "NEW",
          waitMinutes,
          accessToken,
        },
        select: { id: true, number: true },
      });
      created = row;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  if (!created) return { error: "Kon geen bestelnummer maken. Probeer het opnieuw." };

  if (codeInfo) await prisma.discountCode.update({ where: { code: codeInfo.code }, data: { uses: { increment: 1 } } }).catch(() => {});

  if (!online) return { ok: true, orderId: created.id, number: created.number, accessToken, checkoutUrl: null };

  const pay = await startOnlinePayment({ orderId: created.id, amount: round2(total + tip), number: created.number, locale, accessToken, userId: input.userId ?? null });
  if ("error" in pay) return pay;
  return { ok: true, orderId: created.id, number: created.number, accessToken, checkoutUrl: pay.checkoutUrl };
}

async function startOnlinePayment(args: { orderId: string; amount: number; number: number; locale: string; accessToken: string; userId: string | null }): Promise<{ checkoutUrl: string } | { error: string; code: "payment" }> {
  const returnPath = `/${args.locale}/bestellen/status/${args.orderId}?t=${encodeURIComponent(args.accessToken)}`;
  const payment = await prisma.payment.create({
    data: {
      purpose: "FOOD_ORDER",
      amount: args.amount,
      description: `Cards Center bestelling #${args.number}`,
      userId: args.userId,
      metadata: JSON.stringify({ orderId: args.orderId, returnPath, accessToken: args.accessToken }),
    },
  });
  await prisma.foodOrder.update({ where: { id: args.orderId }, data: { paymentId: payment.id } });
  try {
    const created = await createProviderPayment({
      paymentId: payment.id,
      amount: args.amount,
      description: `Cards Center bestelling #${args.number}`,
      redirectPath: returnPath,
      metadata: { orderId: args.orderId },
      locale: args.locale,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: created.provider, providerPaymentId: created.providerPaymentId, checkoutUrl: created.checkoutUrl, status: mapProviderStatus(created.status) },
    });
    return { checkoutUrl: created.checkoutUrl };
  } catch (err) {
    console.error("[food] betaling aanmaken mislukt", err);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failedAt: new Date() } }).catch(() => {});
    await prisma.foodOrder.updateMany({ where: { id: args.orderId, status: "AWAITING_PAYMENT" }, data: { status: "PAYMENT_FAILED" } });
    return { error: "De betaling kon niet gestart worden. Probeer het opnieuw of betaal aan de bar.", code: "payment" };
  }
}

/** Opnieuw betalen (mislukt/verlopen), zolang de bestelling nog vers is. */
export async function retryOrderPayment(args: { orderId: string; accessToken: string; locale: string }): Promise<{ checkoutUrl: string } | { error: string }> {
  const o = await loadOrder(args.orderId);
  if (!o || o.accessToken !== args.accessToken) return { error: "Bestelling niet gevonden" };
  if (o.payment !== "ONLINE" || o.paid) return { error: "Deze bestelling hoeft niet (meer) betaald te worden." };
  if (o.status !== "AWAITING_PAYMENT" && o.status !== "PAYMENT_FAILED") return { error: "Deze bestelling kan niet meer betaald worden." };
  if (Date.now() - o.createdAt.getTime() > UNPAID_ONLINE_MINUTES * 60_000) return { error: "Deze bestelling is verlopen. Plaats een nieuwe bestelling." };
  if (o.paymentRef && (o.paymentRef.status === "OPEN" || o.paymentRef.status === "PENDING") && o.paymentRef.checkoutUrl) {
    return { checkoutUrl: o.paymentRef.checkoutUrl };
  }
  await prisma.foodOrder.updateMany({ where: { id: o.id, status: "PAYMENT_FAILED" }, data: { status: "AWAITING_PAYMENT" } });
  const pay = await startOnlinePayment({ orderId: o.id, amount: round2(o.total + o.tip), number: o.number, locale: args.locale, accessToken: o.accessToken, userId: o.userId });
  return pay;
}

/** Aangeroepen door `applyPaymentStatus` zodra een FOOD_ORDER-betaling van status verandert. */
export async function onFoodOrderPaymentStatus(paymentId: string, next: PaymentStatus, now: Date = new Date()): Promise<void> {
  const order = await prisma.foodOrder.findUnique({ where: { paymentId }, select: { id: true, status: true, paid: true } });
  if (!order) return;
  if (next === "PAID") {
    await prisma.foodOrder.updateMany({
      where: { id: order.id, paid: false },
      data: { paid: true, paidAt: now, status: order.status === "AWAITING_PAYMENT" || order.status === "PAYMENT_FAILED" ? "NEW" : order.status },
    });
    return;
  }
  if (next === "FAILED" || next === "CANCELED" || next === "EXPIRED") {
    await prisma.foodOrder.updateMany({ where: { id: order.id, status: "AWAITING_PAYMENT" }, data: { status: "PAYMENT_FAILED" } });
  }
}

// ---------------------------------------------------------------- gast

export async function getGuestOrder(orderId: string, accessToken: string): Promise<OrderView | null> {
  const o = await loadOrder(orderId);
  if (!o || o.accessToken !== accessToken) return null;
  return toOrderView(o);
}

export async function listOrdersForUser(userId: string, take = 10): Promise<OrderView[]> {
  const rows = await prisma.foodOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { paymentRef: { select: { status: true, checkoutUrl: true } } },
  });
  return rows.map(toOrderView);
}

// ---------------------------------------------------------------- keuken

export async function listKitchenOrders(): Promise<{ open: OrderView[]; finishedToday: number; olderCount: number }> {
  const start = dayStart();
  const [open, finishedToday, olderCount] = await Promise.all([
    prisma.foodOrder.findMany({
      where: { status: { in: KITCHEN_OPEN_STATUSES } },
      orderBy: { createdAt: "asc" },
      include: { paymentRef: { select: { status: true, checkoutUrl: true } } },
    }),
    prisma.foodOrder.count({ where: { status: "DONE", createdAt: { gte: start } } }),
    prisma.foodOrder.count({ where: { createdAt: { lt: start } } }),
  ]);
  return { open: open.map(toOrderView), finishedToday, olderCount };
}

const TRANSITIONS: Record<string, OrderStatus> = { NEW: "PREPARING", PREPARING: "READY", READY: "DONE" };

export async function advanceOrder(orderId: string, to: OrderStatus): Promise<{ ok: true } | { error: string }> {
  const o = await prisma.foodOrder.findUnique({ where: { id: orderId }, select: { status: true, paid: true } });
  if (!o) return { error: "Bestelling niet gevonden" };
  if (TRANSITIONS[o.status] !== to) return { error: `Van ${o.status} kan niet naar ${to}` };
  if (to === "PREPARING" && !o.paid) return { error: "Eerst betalen aan de bar (Markeer betaald)." };
  const now = new Date();
  const r = await prisma.foodOrder.updateMany({
    where: { id: orderId, status: o.status },
    data: { status: to, ...(to === "PREPARING" ? { startedAt: now } : to === "READY" ? { readyAt: now } : { completedAt: now }) },
  });
  return r.count === 1 ? { ok: true } : { error: "Probeer het opnieuw" };
}

export async function markOrderPaidAtBar(orderId: string): Promise<{ ok: true } | { error: string }> {
  const r = await prisma.foodOrder.updateMany({ where: { id: orderId, payment: "BAR", paid: false }, data: { paid: true, paidAt: new Date() } });
  return r.count === 1 ? { ok: true } : { error: "Al betaald of geen barbestelling" };
}

/** Cron: online bestellingen die na 30 min nog niet betaald zijn → PAYMENT_FAILED. */
export async function expireUnpaidOnlineOrders(now: Date = new Date()): Promise<{ expired: number }> {
  const cutoff = new Date(now.getTime() - UNPAID_ONLINE_MINUTES * 60_000);
  const r = await prisma.foodOrder.updateMany({ where: { status: "AWAITING_PAYMENT", createdAt: { lt: cutoff } }, data: { status: "PAYMENT_FAILED" } });
  return { expired: r.count };
}

export interface DayStats {
  orders: number;
  revenue: number;
  tips: number;
  open: number;
  online: number;
  bar: number;
  items: Array<{ id: string; qty: number }>;
}

/** Dagoverzicht: vanaf 00:00 winkel-tijd; alleen bestellingen die de keuken heeft gezien (betaald of bar). */
export async function getDayStats(): Promise<DayStats> {
  const rows = await prisma.foodOrder.findMany({
    where: { createdAt: { gte: dayStart() }, status: { notIn: ["AWAITING_PAYMENT", "PAYMENT_FAILED"] } },
    select: { total: true, tip: true, paid: true, payment: true, lines: true },
  });
  const items: Record<string, number> = {};
  for (const o of rows) for (const l of parseLines(o.lines)) items[l.id] = (items[l.id] ?? 0) + l.qty;
  return {
    orders: rows.length,
    revenue: round2(rows.reduce((s, o) => s + o.total, 0)),
    tips: round2(rows.reduce((s, o) => s + o.tip, 0)),
    open: rows.filter((o) => !o.paid).length,
    online: rows.filter((o) => o.payment === "ONLINE").length,
    bar: rows.filter((o) => o.payment === "BAR" && o.paid).length,
    items: Object.entries(items)
      .map(([id, qty]) => ({ id, qty }))
      .sort((a, b) => b.qty - a.qty),
  };
}

/** "Bestellingen van vorige dagen wissen": alles van vóór vandaag. */
export async function clearOrdersBeforeToday(): Promise<{ deleted: number }> {
  const r = await prisma.foodOrder.deleteMany({ where: { createdAt: { lt: dayStart() } } });
  return { deleted: r.count };
}

/** Voorbeeldbestelling voor de keuken (zonder klant), zelfde recept als het prototype. */
export async function createDemoOrder(): Promise<OrderView> {
  const menu = await getMenu();
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const burgers = menu.items.filter((i) => i.category === "burgers" && !i.soldOut);
  const sauces = menu.items.filter((i) => i.category === "sauzen" && !i.soldOut);
  const drinks = menu.items.filter((i) => i.category === "drank" && !i.soldOut);
  const b = pick(burgers) ?? menu.items[0];
  const g = "g1";
  const lines: BasketLine[] = [
    { id: b.id, qty: 1, removed: Math.random() < 0.5 && b.ingredients.length ? [0] : [], g, role: "main" },
    { id: pick(["friet-k", "friet-m", "friet-g"]), qty: 1, removed: [], g, role: "fries" },
    { id: pick(sauces).id, qty: 1, removed: [], g, role: "sauce" },
    { id: pick(drinks).id, qty: 1, removed: [], g, role: "drink" },
  ];
  if (Math.random() < 0.5) lines.push({ id: "nuggets", qty: 1, removed: [], g: null, role: null });
  const bar = Math.random() < 0.35;
  const atBar = Math.random() < 0.3;
  const r = await placeOrder({
    mode: bar ? "BAR" : "TABLE",
    table: bar ? null : 1 + Math.floor(Math.random() * TABLE_MAX),
    name: bar ? pick(["Sam", "Lotte", "Daan", "Noah", "Fleur"]) : null,
    basket: lines,
    note: Math.random() < 0.4 ? pick(["Burger goed doorbakken", "Extra servetten graag", "Sausjes apart"]) : null,
    payment: atBar ? "BAR" : "ONLINE",
    method: atBar ? null : "ideal",
    locale: "nl",
  });
  if ("error" in r) throw new Error(r.error);
  if (!atBar) {
    // Demo: online betaling direct als betaald markeren (geen echte checkout).
    const o = await prisma.foodOrder.findUniqueOrThrow({ where: { id: r.orderId }, select: { paymentId: true } });
    if (o.paymentId) {
      await prisma.payment.update({ where: { id: o.paymentId }, data: { status: "PAID", paidAt: new Date() } });
      await onFoodOrderPaymentStatus(o.paymentId, "PAID");
    }
  }
  const o = await loadOrder(r.orderId);
  return toOrderView(o!);
}

/** Zodat de demo altijd kan: menu-ids die de keuken-demo verwacht. */
export const DEMO_ITEM_IDS = DEFAULT_ITEMS.map((i) => i.id);
export const KITCHEN_TIMEZONE = SHOP_TIMEZONE;
export type { MenuView };
