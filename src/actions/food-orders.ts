"use server";

import { auth } from "@/lib/auth";
import { getMenu, getWaitMinutes } from "@/lib/food/menu-server";
import { getGuestOrder, placeOrder, retryOrderPayment, resolveDiscountCode, type OrderView, type PlaceOrderInput } from "@/lib/food/orders";
import { isMollieConfigured } from "@/lib/mollie";
import { syncPaymentFromProvider } from "@/lib/shop-events/registrations";
import { prisma } from "@/lib/prisma";

/**
 * Server actions voor gasten van de bestelapp (geen account nodig). Alle
 * bedragen worden server-side herberekend in `placeOrder`.
 */

/** Live menu-staat voor de client: uitverkocht + wachttijd (polling op het menu). */
export async function getMenuState(): Promise<{ soldOut: string[]; waitMinutes: number }> {
  const [menu, waitMinutes] = await Promise.all([getMenu(), getWaitMinutes()]);
  return { soldOut: menu.items.filter((i) => i.soldOut).map((i) => i.id), waitMinutes };
}

export async function checkDiscountCode(raw: string): Promise<{ ok: true; code: string; type: "PCT" | "EUR"; value: number } | { ok: false }> {
  const r = await resolveDiscountCode(raw);
  return r ? { ok: true, code: r.code, type: r.rule.type, value: r.rule.value } : { ok: false };
}

export async function placeFoodOrder(input: Omit<PlaceOrderInput, "userId">) {
  const session = await auth();
  return placeOrder({ ...input, userId: session?.user?.id ?? null });
}

export async function getFoodOrderStatus(orderId: string, accessToken: string): Promise<OrderView | null> {
  const order = await getGuestOrder(orderId, accessToken);
  if (!order) return null;
  // Terugkeer van de checkout: status direct bij Mollie ophalen (webhook blijft leidend).
  if (order.payment === "ONLINE" && !order.paid && isMollieConfigured()) {
    const row = await prisma.foodOrder.findUnique({ where: { id: orderId }, select: { paymentId: true } });
    if (row?.paymentId) {
      await syncPaymentFromProvider(row.paymentId, "return");
      return getGuestOrder(orderId, accessToken);
    }
  }
  return order;
}

export async function retryFoodPayment(orderId: string, accessToken: string, locale: string) {
  return retryOrderPayment({ orderId, accessToken, locale });
}
