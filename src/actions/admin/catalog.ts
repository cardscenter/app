"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { revalidatePath } from "next/cache";

// ─── Series ───────────────────────────────────────────────────────────────

export async function createSeries(formData: FormData) {
  const { adminId } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const tcgdexSeriesId = String(formData.get("tcgdexSeriesId") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim();

  if (!name) return { error: "Naam is verplicht" };
  if (!categoryId) return { error: "Category is verplicht" };

  const created = await prisma.series.create({
    data: { name, tcgdexSeriesId, logoUrl, categoryId },
  });

  await logAdminAction({
    adminId,
    action: "EDIT_SERIES",
    targetType: "SERIES",
    targetId: created.id,
    metadata: { op: "create", name, tcgdexSeriesId, logoUrl, categoryId },
  });

  revalidatePath("/dashboard/admin/catalog");
  return { success: true, id: created.id };
}

export async function updateSeries(seriesId: string, formData: FormData) {
  const { adminId } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const tcgdexSeriesId = String(formData.get("tcgdexSeriesId") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  if (!name) return { error: "Naam is verplicht" };

  await prisma.series.update({
    where: { id: seriesId },
    data: { name, tcgdexSeriesId, logoUrl },
  });

  await logAdminAction({
    adminId,
    action: "EDIT_SERIES",
    targetType: "SERIES",
    targetId: seriesId,
    metadata: { op: "update", name, tcgdexSeriesId, logoUrl },
  });

  revalidatePath("/dashboard/admin/catalog");
  return { success: true };
}

// ─── CardSet ──────────────────────────────────────────────────────────────

export async function createCardSet(formData: FormData) {
  const { adminId } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const tcgdexSetId = String(formData.get("tcgdexSetId") ?? "").trim() || null;
  const pokewalletSetId = String(formData.get("pokewalletSetId") ?? "").trim() || null;
  const pokewalletSetCode = String(formData.get("pokewalletSetCode") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const symbolUrl = String(formData.get("symbolUrl") ?? "").trim() || null;
  const releaseDate = String(formData.get("releaseDate") ?? "").trim() || null;
  const cardCountStr = String(formData.get("cardCount") ?? "").trim();
  const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : null;

  if (!name) return { error: "Naam is verplicht" };
  if (!seriesId) return { error: "Series is verplicht" };

  const created = await prisma.cardSet.create({
    data: { name, seriesId, tcgdexSetId, pokewalletSetId, pokewalletSetCode, logoUrl, symbolUrl, releaseDate, cardCount },
  });

  await logAdminAction({
    adminId,
    action: "EDIT_CARDSET",
    targetType: "CARDSET",
    targetId: created.id,
    metadata: { op: "create", name, seriesId },
  });

  revalidatePath("/dashboard/admin/catalog");
  return { success: true, id: created.id };
}

export async function updateCardSet(setId: string, formData: FormData) {
  const { adminId } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const tcgdexSetId = String(formData.get("tcgdexSetId") ?? "").trim() || null;
  const pokewalletSetId = String(formData.get("pokewalletSetId") ?? "").trim() || null;
  const pokewalletSetCode = String(formData.get("pokewalletSetCode") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const symbolUrl = String(formData.get("symbolUrl") ?? "").trim() || null;
  const releaseDate = String(formData.get("releaseDate") ?? "").trim() || null;
  const cardCountStr = String(formData.get("cardCount") ?? "").trim();
  const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : null;

  if (!name) return { error: "Naam is verplicht" };

  await prisma.cardSet.update({
    where: { id: setId },
    data: { name, tcgdexSetId, pokewalletSetId, pokewalletSetCode, logoUrl, symbolUrl, releaseDate, cardCount },
  });

  await logAdminAction({
    adminId,
    action: "EDIT_CARDSET",
    targetType: "CARDSET",
    targetId: setId,
    metadata: { op: "update", name },
  });

  revalidatePath("/dashboard/admin/catalog");
  return { success: true };
}

// ─── Card ─────────────────────────────────────────────────────────────────

export async function updateCardMeta(cardId: string, formData: FormData) {
  const { adminId } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const rarity = String(formData.get("rarity") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const imageUrlFull = String(formData.get("imageUrlFull") ?? "").trim() || null;

  if (!name) return { error: "Naam is verplicht" };

  await prisma.card.update({
    where: { id: cardId },
    data: { name, rarity, imageUrl, imageUrlFull },
  });

  await logAdminAction({
    adminId,
    action: "EDIT_CARD",
    targetType: "CARD",
    targetId: cardId,
    metadata: { op: "update", name, rarity },
  });

  revalidatePath("/dashboard/admin/catalog");
  return { success: true };
}
