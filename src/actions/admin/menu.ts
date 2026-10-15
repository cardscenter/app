"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { invalidateMenuCache } from "@/lib/food/menu-server";
import { normalizeCode } from "@/lib/food/pricing";

/**
 * Admin: menu en kortingscodes (Fase 4). Patroon requireAdmin → schrijven →
 * logAdminAction. Items aanmaken/verwijderen is bewust niet in scope: het
 * assortiment komt uit de seed; aan/uit, prijs en teksten zijn aanpasbaar.
 */

const itemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional().default(""),
  descriptionEn: z.string().trim().max(300).optional().default(""),
  price: z.coerce.number().min(0).max(200),
  enabled: z.coerce.boolean(),
  soldOut: z.coerce.boolean(),
  tag: z.string().trim().max(30).optional().default(""),
  tagEn: z.string().trim().max(30).optional().default(""),
});

export async function updateMenuItem(id: string, input: z.input<typeof itemSchema>) {
  const { adminId } = await requireAdmin();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const d = parsed.data;
  const row = await prisma.menuItem.update({
    where: { id },
    data: {
      name: d.name,
      nameEn: d.nameEn,
      description: d.description || null,
      descriptionEn: d.descriptionEn || null,
      price: Math.round(d.price * 100) / 100,
      enabled: d.enabled,
      soldOut: d.soldOut,
      tag: d.tag || null,
      tagEn: d.tagEn || null,
    },
  });
  invalidateMenuCache();
  await logAdminAction({ adminId, action: "UPDATE_MENU_ITEM", targetType: "MENU_ITEM", targetId: id, metadata: { price: row.price, enabled: row.enabled, soldOut: row.soldOut } });
  revalidatePath("/dashboard/admin/menu");
  return { success: true };
}

export async function toggleMenuItem(id: string, field: "enabled" | "soldOut", value: boolean) {
  const { adminId } = await requireAdmin();
  await prisma.menuItem.update({ where: { id }, data: { [field]: value } });
  invalidateMenuCache();
  await logAdminAction({ adminId, action: "UPDATE_MENU_ITEM", targetType: "MENU_ITEM", targetId: id, metadata: { [field]: value } });
  revalidatePath("/dashboard/admin/menu");
  return { success: true };
}

const codeSchema = z.object({
  code: z.string().trim().min(2).max(20),
  type: z.enum(["PCT", "EUR"]),
  value: z.coerce.number().positive().max(100),
  enabled: z.coerce.boolean().default(true),
  expiresAt: z.string().trim().optional().default(""),
  maxUses: z.coerce.number().int().min(0).max(100000).optional().default(0),
});

export async function saveDiscountCode(input: z.input<typeof codeSchema>) {
  const { adminId } = await requireAdmin();
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const d = parsed.data;
  const code = normalizeCode(d.code);
  if (!/^[A-Z0-9]{2,20}$/.test(code)) return { error: "Code: alleen letters en cijfers" };
  if (d.type === "PCT" && d.value > 100) return { error: "Percentage boven 100" };
  const expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: "Ongeldige datum" };
  await prisma.discountCode.upsert({
    where: { code },
    create: { code, type: d.type, value: d.value, enabled: d.enabled, expiresAt, maxUses: d.maxUses || null },
    update: { type: d.type, value: d.value, enabled: d.enabled, expiresAt, maxUses: d.maxUses || null },
  });
  await logAdminAction({ adminId, action: "SAVE_DISCOUNT_CODE", targetType: "DISCOUNT_CODE", targetId: code, metadata: { type: d.type, value: d.value, enabled: d.enabled } });
  revalidatePath("/dashboard/admin/menu");
  return { success: true, code };
}

export async function deleteDiscountCode(code: string) {
  const { adminId } = await requireAdmin();
  await prisma.discountCode.delete({ where: { code } }).catch(() => {});
  await logAdminAction({ adminId, action: "SAVE_DISCOUNT_CODE", targetType: "DISCOUNT_CODE", targetId: code, metadata: { deleted: true } });
  revalidatePath("/dashboard/admin/menu");
  return { success: true };
}
