"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { testimonialSchema } from "@/lib/validations/community";
import { formDataToObject, firstZodError } from "@/lib/validations/shop-event";

/**
 * Admin-acties voor ervaringen (design-pass Fase C). Patroon: requireAdmin →
 * schrijven → logAdminAction. De muur op /ervaringen en de homepage-rij
 * worden na elke wijziging opnieuw gerenderd.
 */

function revalidateTestimonials() {
  revalidatePath("/ervaringen");
  revalidatePath("/");
  revalidatePath("/dashboard/admin/testimonials");
}

export async function saveTestimonial(formData: FormData, existingId?: string | null) {
  const { adminId } = await requireAdmin();
  const parsed = testimonialSchema.safeParse(formDataToObject(formData, ["approved", "featured"]));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const avatar = d.avatarUrl || null;
  if (avatar && !avatar.startsWith("/api/uploads/") && !avatar.startsWith("/images/")) return { error: "Foto moet een geüpload bestand zijn" };
  const data = {
    quote: d.quote,
    authorName: d.authorName,
    authorRole: d.authorRole || null,
    source: d.source,
    sourceUrl: d.sourceUrl || null,
    avatarUrl: avatar,
    color: d.color,
    approved: d.approved,
    featured: d.featured,
    sortOrder: d.sortOrder,
  };
  const existing = existingId ? await prisma.shopTestimonial.findUnique({ where: { id: existingId }, select: { id: true } }) : null;
  if (existingId && !existing) return { error: "Ervaring niet gevonden" };
  const row = existing ? await prisma.shopTestimonial.update({ where: { id: existing.id }, data }) : await prisma.shopTestimonial.create({ data });
  await logAdminAction({ adminId, action: "SAVE_TESTIMONIAL", targetType: "TESTIMONIAL", targetId: row.id, metadata: { approved: row.approved, featured: row.featured } });
  revalidateTestimonials();
  return { success: true, id: row.id };
}

export async function deleteTestimonial(id: string) {
  const { adminId } = await requireAdmin();
  const row = await prisma.shopTestimonial.delete({ where: { id } }).catch(() => null);
  if (!row) return { error: "Ervaring niet gevonden" };
  await logAdminAction({ adminId, action: "DELETE_TESTIMONIAL", targetType: "TESTIMONIAL", targetId: id });
  revalidateTestimonials();
  return { success: true };
}

/** Snelle schakelaars in de lijst (goedgekeurd / op de homepage). */
export async function toggleTestimonialFlag(id: string, flag: "approved" | "featured", value: boolean) {
  const { adminId } = await requireAdmin();
  const row = await prisma.shopTestimonial.update({ where: { id }, data: { [flag]: value } }).catch(() => null);
  if (!row) return { error: "Ervaring niet gevonden" };
  await logAdminAction({ adminId, action: "SAVE_TESTIMONIAL", targetType: "TESTIMONIAL", targetId: id, metadata: { [flag]: value } });
  revalidateTestimonials();
  return { success: true };
}
