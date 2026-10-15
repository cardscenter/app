import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/notification", () => ({ createNotification: vi.fn(async () => {}) }));

import { prisma } from "@/lib/prisma";
import { ensureMenu, getMenu, setItemSoldOut } from "@/lib/food/menu-server";
import { advanceOrder, expireUnpaidOnlineOrders, getDayStats, getGuestOrder, listKitchenOrders, markOrderPaidAtBar, placeOrder, retryOrderPayment } from "@/lib/food/orders";
import { applyPaymentStatus } from "@/lib/shop-events/registrations";

const createdIds: string[] = [];

describe("eten bestellen: plaatsen, betalen, keuken, dagoverzicht", () => {
  beforeAll(async () => {
    await ensureMenu();
    await setItemSoldOut("loempia", false);
  });

  afterAll(async () => {
    await prisma.foodOrder.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.payment.deleteMany({ where: { purpose: "FOOD_ORDER", foodOrder: null } });
    await setItemSoldOut("loempia", false);
    await prisma.$disconnect();
  });

  it("weigert alleen drinken, lege mand en ongeldige tafel", async () => {
    const drinks = await placeOrder({ mode: "TABLE", table: 3, basket: [{ id: "cola", qty: 2, removed: [], g: null, role: null }], payment: "BAR", locale: "nl" });
    expect("error" in drinks && drinks.code).toBe("drinks-only");
    const empty = await placeOrder({ mode: "TABLE", table: 3, basket: [], payment: "BAR", locale: "nl" });
    expect("error" in empty && empty.code).toBe("empty");
    const table = await placeOrder({ mode: "TABLE", table: 99, basket: [{ id: "nuggets", qty: 1, removed: [], g: null, role: null }], payment: "BAR", locale: "nl" });
    expect("error" in table && table.code).toBe("table");
    const name = await placeOrder({ mode: "BAR", name: "  ", basket: [{ id: "nuggets", qty: 1, removed: [], g: null, role: null }], payment: "BAR", locale: "nl" });
    expect("error" in name && name.code).toBe("name");
  });

  it("menu-combo: server rekent menuvoordeel en kortingscode zelf uit; online → simulatie-checkout → betaald → keuken", async () => {
    const basket = [
      { id: "bacon", qty: 1, removed: [0], g: "g1", role: "main" },
      { id: "friet-g", qty: 1, removed: [], g: "g1", role: "fries" },
      { id: "saus-speciaal", qty: 1, removed: [], g: "g1", role: "sauce" },
      { id: "fanta", qty: 1, removed: [], g: "g1", role: "drink" },
      { id: "nuggets", qty: 2, removed: [], g: null, role: null },
    ];
    const r = await placeOrder({ mode: "TABLE", table: 7, basket, note: "Goed doorbakken", code: "vrienden", tip: 1, payment: "ONLINE", method: "ideal", locale: "nl" });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    createdIds.push(r.orderId);
    expect(r.checkoutUrl).toContain("/nl/betalen/simuleer/");
    expect(r.number).toBeGreaterThanOrEqual(101);

    const o = await getGuestOrder(r.orderId, r.accessToken);
    expect(o).not.toBeNull();
    // 9.95 + 3.00 + 0 + 1.50 + 2×4.95 = 24.35; VRIENDEN 10% = 2.44 (afgerond) → 21.91
    expect(o!.subtotal).toBe(24.35);
    expect(o!.savings).toBe(2.0);
    expect(o!.discount).toBe(2.44);
    expect(o!.total).toBe(21.91);
    expect(o!.tip).toBe(1);
    expect(o!.status).toBe("AWAITING_PAYMENT");
    expect(o!.paid).toBe(false);
    expect(o!.method).toBe("iDEAL");
    expect(await getGuestOrder(r.orderId, "verkeerd")).toBeNull();

    // Nog niet betaald → niet in de keuken.
    expect((await listKitchenOrders()).open.some((x) => x.id === r.orderId)).toBe(false);

    const row = await prisma.foodOrder.findUniqueOrThrow({ where: { id: r.orderId }, include: { paymentRef: true } });
    expect(row.paymentRef?.amount).toBe(22.91);
    const paid = await applyPaymentStatus({ paymentId: row.paymentId!, providerStatus: "paid", source: "simulate" });
    expect("ok" in paid && paid.paymentStatus).toBe("PAID");
    const o2 = await getGuestOrder(r.orderId, r.accessToken);
    expect(o2!.paid).toBe(true);
    expect(o2!.status).toBe("NEW");
    expect((await listKitchenOrders()).open.some((x) => x.id === r.orderId)).toBe(true);

    // Keuken: NEW → PREPARING → READY → DONE, geen sprongen.
    expect(await advanceOrder(r.orderId, "READY")).toMatchObject({ error: expect.any(String) });
    expect(await advanceOrder(r.orderId, "PREPARING")).toEqual({ ok: true });
    expect(await advanceOrder(r.orderId, "READY")).toEqual({ ok: true });
    expect(await advanceOrder(r.orderId, "DONE")).toEqual({ ok: true });
    expect((await getGuestOrder(r.orderId, r.accessToken))!.status).toBe("DONE");
  });

  it("barbestelling: keuken kan pas starten na Markeer betaald; dagoverzicht telt mee", async () => {
    const r = await placeOrder({ mode: "BAR", name: "Sam", basket: [{ id: "lf-pork", qty: 1, removed: [], g: null, role: null }], payment: "BAR", tip: 2, locale: "nl" });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    createdIds.push(r.orderId);
    const o = await getGuestOrder(r.orderId, r.accessToken);
    expect(o!.status).toBe("NEW");
    expect(o!.paid).toBe(false);
    expect(o!.tip).toBe(0); // fooi alleen online
    expect(await advanceOrder(r.orderId, "PREPARING")).toMatchObject({ error: expect.stringContaining("betalen") });
    expect(await markOrderPaidAtBar(r.orderId)).toEqual({ ok: true });
    expect(await markOrderPaidAtBar(r.orderId)).toMatchObject({ error: expect.any(String) });
    expect(await advanceOrder(r.orderId, "PREPARING")).toEqual({ ok: true });

    const stats = await getDayStats();
    expect(stats.orders).toBeGreaterThanOrEqual(2);
    expect(stats.items.find((i) => i.id === "lf-pork")?.qty).toBeGreaterThanOrEqual(1);
  });

  it("uitverkocht blokkeert; verlopen online bestelling → PAYMENT_FAILED; opnieuw betalen", async () => {
    await setItemSoldOut("loempia", true);
    const menu = await getMenu();
    expect(menu.byId.loempia.soldOut).toBe(true);
    const blocked = await placeOrder({ mode: "TABLE", table: 1, basket: [{ id: "loempia", qty: 1, removed: [], g: null, role: null }], payment: "BAR", locale: "nl" });
    expect("error" in blocked && blocked.code).toBe("sold-out");
    await setItemSoldOut("loempia", false);

    const r = await placeOrder({ mode: "TABLE", table: 2, basket: [{ id: "mozza", qty: 1, removed: [], g: null, role: null }], payment: "ONLINE", method: "card", locale: "en" });
    expect("ok" in r).toBe(true);
    if (!("ok" in r)) return;
    createdIds.push(r.orderId);
    await prisma.foodOrder.update({ where: { id: r.orderId }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    const exp = await expireUnpaidOnlineOrders();
    expect(exp.expired).toBeGreaterThanOrEqual(1);
    expect((await getGuestOrder(r.orderId, r.accessToken))!.status).toBe("PAYMENT_FAILED");
    const retry = await retryOrderPayment({ orderId: r.orderId, accessToken: r.accessToken, locale: "en" });
    expect("error" in retry).toBe(true); // ouder dan 30 min
  });
});
