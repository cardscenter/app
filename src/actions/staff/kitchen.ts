"use server";

import { requireStaff } from "@/lib/roles-server";
import { getMenu, setItemSoldOut, setWaitMinutes, getWaitMinutes } from "@/lib/food/menu-server";
import {
  advanceOrder,
  clearOrdersBeforeToday,
  createDemoOrder,
  getDayStats,
  listKitchenOrders,
  markOrderPaidAtBar,
  type OrderStatus,
} from "@/lib/food/orders";

/**
 * Keuken & bar (Community Hub, Fase 4): alleen rol STAFF of ADMIN. Het
 * keukenscherm pollt `getKitchenBoard` elke 5 seconden.
 */

async function guard() {
  try {
    return await requireStaff();
  } catch {
    return null;
  }
}

export async function getKitchenBoard() {
  if (!(await guard())) return { error: "Geen toegang" as const };
  const [board, menu, waitMinutes, stats] = await Promise.all([listKitchenOrders(), getMenu({ includeDisabled: true }), getWaitMinutes(), getDayStats()]);
  return {
    ...board,
    waitMinutes,
    soldOut: menu.items.filter((i) => i.soldOut).map((i) => i.id),
    stats,
  };
}

export async function kitchenAdvance(orderId: string, to: OrderStatus) {
  if (!(await guard())) return { error: "Geen toegang" };
  return advanceOrder(orderId, to);
}

export async function kitchenMarkPaid(orderId: string) {
  if (!(await guard())) return { error: "Geen toegang" };
  return markOrderPaidAtBar(orderId);
}

export async function kitchenSetWait(minutes: number) {
  if (!(await guard())) return { error: "Geen toegang" };
  try {
    await setWaitMinutes(minutes);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Mislukt" };
  }
}

export async function kitchenSetSoldOut(itemId: string, soldOut: boolean) {
  if (!(await guard())) return { error: "Geen toegang" };
  await setItemSoldOut(itemId, soldOut);
  return { ok: true };
}

export async function kitchenDemoOrder() {
  if (!(await guard())) return { error: "Geen toegang" };
  try {
    const o = await createDemoOrder();
    return { ok: true, number: o.number };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Mislukt" };
  }
}

export async function kitchenClearOld() {
  if (!(await guard())) return { error: "Geen toegang" };
  return clearOrdersBeforeToday();
}
