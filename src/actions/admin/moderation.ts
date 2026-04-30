"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { revalidatePath } from "next/cache";

async function notifySellerRemoved(sellerId: string, kind: "veiling" | "listing" | "claimsale", title: string, reason: string) {
  await createNotification(
    sellerId,
    "NEW_MESSAGE",
    `${kind} verwijderd door admin`,
    `Je ${kind} "${title}" is verwijderd door een beheerder. Reden: ${reason}`,
    "/dashboard"
  );
}

export async function bulkRemoveListings(ids: string[], reason: string) {
  const { adminId } = await requireAdmin();
  if (!ids.length) return { error: "Geen items geselecteerd" };
  if (!reason.trim() || reason.trim().length < 5) return { error: "Reden minimaal 5 tekens" };

  const items = await prisma.listing.findMany({
    where: { id: { in: ids }, status: { not: "DELETED" } },
    select: { id: true, title: true, sellerId: true },
  });

  for (const it of items) {
    await prisma.listing.update({ where: { id: it.id }, data: { status: "DELETED" } });
    await notifySellerRemoved(it.sellerId, "listing", it.title, reason.trim());
  }

  await logAdminAction({
    adminId,
    action: "BULK_REMOVE_LISTINGS",
    targetType: "LISTING",
    targetId: null,
    metadata: { ids: items.map((i) => i.id), reason: reason.trim(), count: items.length },
  });

  revalidatePath("/dashboard/admin/moderation");
  return { success: true, count: items.length };
}

export async function bulkRemoveAuctions(ids: string[], reason: string) {
  const { adminId } = await requireAdmin();
  if (!ids.length) return { error: "Geen items geselecteerd" };
  if (!reason.trim() || reason.trim().length < 5) return { error: "Reden minimaal 5 tekens" };

  const items = await prisma.auction.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, sellerId: true, status: true },
  });

  for (const it of items) {
    if (it.status === "CANCELLED") continue;
    // Auction has no DELETED status — CANCELLED is the closest equivalent.
    // The audit log makes it clear this came from an admin removal.
    await prisma.auction.update({ where: { id: it.id }, data: { status: "CANCELLED" } });
    await notifySellerRemoved(it.sellerId, "veiling", it.title, reason.trim());
  }

  await logAdminAction({
    adminId,
    action: "BULK_REMOVE_AUCTIONS",
    targetType: "AUCTION",
    targetId: null,
    metadata: { ids: items.map((i) => i.id), reason: reason.trim(), count: items.length },
  });

  revalidatePath("/dashboard/admin/moderation");
  return { success: true, count: items.length };
}

export async function bulkRemoveClaimsales(ids: string[], reason: string) {
  const { adminId } = await requireAdmin();
  if (!ids.length) return { error: "Geen items geselecteerd" };
  if (!reason.trim() || reason.trim().length < 5) return { error: "Reden minimaal 5 tekens" };

  const items = await prisma.claimsale.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, sellerId: true, status: true },
  });

  for (const it of items) {
    if (it.status === "CLOSED") continue;
    // Claimsale has no DELETED status — CLOSED is the closest equivalent.
    await prisma.claimsale.update({ where: { id: it.id }, data: { status: "CLOSED" } });
    await notifySellerRemoved(it.sellerId, "claimsale", it.title, reason.trim());
  }

  await logAdminAction({
    adminId,
    action: "BULK_REMOVE_CLAIMSALES",
    targetType: "CLAIMSALE",
    targetId: null,
    metadata: { ids: items.map((i) => i.id), reason: reason.trim(), count: items.length },
  });

  revalidatePath("/dashboard/admin/moderation");
  return { success: true, count: items.length };
}
