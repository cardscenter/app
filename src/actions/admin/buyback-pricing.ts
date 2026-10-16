"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { ensureBulkPricing, invalidateBulkPricingCache } from "@/lib/buyback-pricing-db";

/** Admin: bulk-inkooptarieven beheren (Community Hub, Fase 6). */

const rowSchema = z.object({
  name: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(1000),
  weightGrams: z.coerce.number().min(0.1).max(5000),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  enabled: z.coerce.boolean(),
});

export async function updateBulkPrice(key: string, input: unknown) {
  const { adminId } = await requireAdmin();
  await ensureBulkPricing();
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const existing = await prisma.bulkPriceCategory.findUnique({ where: { key } });
  if (!existing) return { error: "Categorie niet gevonden" };
  const d = parsed.data;
  await prisma.bulkPriceCategory.update({
    where: { key },
    data: { name: d.name, nameEn: d.nameEn, description: d.description || null, price: Math.round(d.price * 100) / 100, weightGrams: d.weightGrams, sortOrder: d.sortOrder, enabled: d.enabled },
  });
  invalidateBulkPricingCache();
  await logAdminAction({ adminId, action: "UPDATE_BULK_PRICE", targetType: "BULK_PRICE", targetId: key, metadata: { from: existing.price, to: d.price, enabled: d.enabled } });
  revalidatePath("/dashboard/admin/buyback-pricing");
  revalidatePath("/verkopen");
  revalidatePath("/verkopen/bulk");
  return { success: true };
}
