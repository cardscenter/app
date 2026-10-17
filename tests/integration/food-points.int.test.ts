import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/notification", () => ({ createNotification: vi.fn(async () => {}) }));

import { prisma } from "@/lib/prisma";
import { ensureMenu, setItemSoldOut } from "@/lib/food/menu-server";
import { expireUnpaidOnlineOrders, getGuestOrder, markOrderPaidAtBar, placeOrder } from "@/lib/food/orders";
import { applyPaymentStatus } from "@/lib/shop-events/registrations";

const TAG = `fp${Date.now().toString(36)}`;
const NUGGETS = { id: "nuggets", qty: 1, removed: [], g: null, role: null };
const orderIds: string[] = [];
let userId = "";

async function balance(): Promise<number> {
  const agg = await prisma.loyaltyEntry.aggregate({ where: { userId, kind: "POINTS" }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}
async function setBalance(target: number) {
  const diff = target - (await balance());
  if (diff !== 0) await prisma.loyaltyEntry.create({ data: { userId, kind: "POINTS", delta: diff, reason: "test", source: "STAFF" } });
}
async function place(extra: Partial<Parameters<typeof placeOrder>[0]> = {}) {
  const r = await placeOrder({ mode: "TABLE", table: 4, basket: [NUGGETS], payment: "ONLINE", method: "ideal", locale: "nl", userId, usePoints: true, ...extra });
  if ("ok" in r) orderIds.push(r.orderId);
  return r;
}

describe("spaarpunten op eten (1 punt = 1 cent)", () => {
  beforeAll(async () => {
    await ensureMenu();
    await setItemSoldOut("nuggets", false);
    const u = await prisma.user.create({
      data: {
        email: `${TAG}@test.local`,
        displayName: TAG.slice(0, 16),
        passwordHash: "x",
        emailVerifiedAt: new Date(),
        dateOfBirth: new Date(Date.UTC(1990, 0, 1)),
        bankTransferReference: TAG.slice(0, 20),
      },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.foodOrder.deleteMany({ where: { OR: [{ id: { in: orderIds } }, { userId }] } });
    await prisma.payment.deleteMany({ where: { purpose: "FOOD_ORDER", foodOrder: null } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("gast kan geen punten inzetten", async () => {
    const r = await place({ userId: null });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    const o = await getGuestOrder(r.orderId, r.accessToken);
    expect(o!.pointsUsed).toBe(0);
    expect(o!.total).toBe(4.95);
  });

  it("deel van de rekening met punten; na betalen 5 punten per betaalde euro, één keer", async () => {
    await setBalance(340);
    const r = await place({ basket: [{ ...NUGGETS, qty: 2 }], tip: 1 });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    const o = await getGuestOrder(r.orderId, r.accessToken);
    // 2 × 4,95 = 9,90; 340 punten = 3,40 → 6,50 te betalen (+ 1,00 fooi)
    expect(o!.pointsUsed).toBe(340);
    expect(o!.pointsDiscount).toBe(3.4);
    expect(o!.total).toBe(6.5);
    expect(await balance()).toBe(0);
    const row = await prisma.foodOrder.findUniqueOrThrow({ where: { id: r.orderId }, include: { paymentRef: true } });
    expect(row.paymentRef?.amount).toBe(7.5);

    await applyPaymentStatus({ paymentId: row.paymentId!, providerStatus: "paid", source: "simulate" });
    await applyPaymentStatus({ paymentId: row.paymentId!, providerStatus: "paid", source: "simulate" });
    // floor(6,50 × 5) = 32, niet over de punten en niet over de fooi
    expect(await balance()).toBe(32);
    expect((await getGuestOrder(r.orderId, r.accessToken))!.pointsEarned).toBe(32);
  });

  it("punten dekken alles: meteen betaald, geen Mollie, niets verdiend", async () => {
    await setBalance(1000);
    const r = await place();
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    expect(r.checkoutUrl).toBeNull();
    const row = await prisma.foodOrder.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(row.paid).toBe(true);
    expect(row.status).toBe("NEW");
    expect(row.paymentId).toBeNull();
    expect(row.pointsUsed).toBe(495);
    expect(row.total).toBe(0);
    expect(row.method).toBe("Spaarpunten");
    expect(await balance()).toBe(505);
  });

  it("aan de bar: rest betaald → punten verdiend over het restbedrag", async () => {
    await setBalance(195);
    const r = await place({ payment: "BAR" });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    expect(await balance()).toBe(0);
    expect(await markOrderPaidAtBar(r.orderId)).toEqual({ ok: true });
    // 4,95 − 1,95 = 3,00 → 15 punten
    expect(await balance()).toBe(15);
  });

  it("onbetaald vervallen: punten één keer terug; alsnog betaald → er weer af", async () => {
    await setBalance(200);
    const r = await place();
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    expect(await balance()).toBe(0);
    await prisma.foodOrder.update({ where: { id: r.orderId }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    const e1 = await expireUnpaidOnlineOrders();
    expect(e1.refunded).toBeGreaterThanOrEqual(1);
    expect(await balance()).toBe(200);
    await expireUnpaidOnlineOrders();
    expect(await balance()).toBe(200);

    const row = await prisma.foodOrder.findUniqueOrThrow({ where: { id: r.orderId } });
    await applyPaymentStatus({ paymentId: row.paymentId!, providerStatus: "paid", source: "simulate" });
    // 200 punten er weer af, plus floor(2,95 × 5) = 14 verdiend
    expect(await balance()).toBe(14);
  });

  it("twee bestellingen tegelijk met te weinig saldo: saldo nooit onder nul", async () => {
    await setBalance(500);
    const results = await Promise.all([place(), place()]);
    expect(results.some((x) => "ok" in x)).toBe(true);
    expect(await balance()).toBeGreaterThanOrEqual(0);
    const spent = await prisma.foodOrder.aggregate({ where: { id: { in: results.flatMap((x) => ("ok" in x ? [x.orderId] : [])) } }, _sum: { pointsUsed: true } });
    expect(spent._sum.pointsUsed ?? 0).toBeLessThanOrEqual(500);
  });
});
