"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { formDataToObject, firstZodError } from "@/lib/validations/shop-event";
import { leagueSeasonSchema, leagueBadgeSchema, newsPostSchema, internalNoteSchema } from "@/lib/validations/community";
import { shopWallClockToUtc } from "@/lib/shop-events/format";
import { ensureLeagueDefaults } from "@/lib/community/league";
import { sendNewsletterForPost, uniqueSlug } from "@/lib/community/news";

/**
 * Admin-acties Community Hub Fase 5: league-seizoenen, badges, nieuws,
 * interne notitie. Patroon: requireAdmin → schrijven → logAdminAction.
 */

function revalidateLeague() {
  revalidatePath("/league");
  revalidatePath("/dashboard/league");
  revalidatePath("/dashboard/admin/league");
  revalidatePath("/dashboard/staff/league");
}

function revalidateNews(slug?: string) {
  revalidatePath("/nieuws");
  revalidatePath("/");
  revalidatePath("/dashboard/admin/news");
  if (slug) revalidatePath(`/nieuws/${slug}`);
}

// ---------------------------------------------------------------- seizoenen

export async function saveLeagueSeason(formData: FormData, existingId?: string | null) {
  const { adminId } = await requireAdmin();
  const parsed = leagueSeasonSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const startsAt = shopWallClockToUtc(d.startsAt, "00:00");
  const endsAt = shopWallClockToUtc(d.endsAt, "23:59");
  if (!startsAt || !endsAt) return { error: "Ongeldige datum" };
  const data = {
    name: d.name,
    game: d.game || null,
    description: d.description || null,
    startsAt,
    endsAt,
    pointsWin: d.pointsWin,
    pointsDraw: d.pointsDraw,
    pointsLoss: d.pointsLoss,
    pointsParticipation: d.pointsParticipation,
  };
  const season = existingId
    ? await prisma.leagueSeason.update({ where: { id: existingId }, data })
    : await prisma.leagueSeason.create({ data });
  // Punten van bestaande uitslagen herberekenen als de regels wijzigen.
  if (existingId) {
    const results = await prisma.leagueResult.findMany({ where: { seasonId: existingId } });
    for (const r of results) {
      const points = r.wins * data.pointsWin + r.draws * data.pointsDraw + r.losses * data.pointsLoss + data.pointsParticipation + r.bonusPoints;
      if (points !== r.points) await prisma.leagueResult.update({ where: { id: r.id }, data: { points } });
    }
  }
  await logAdminAction({ adminId, action: "SAVE_LEAGUE_SEASON", targetType: "LEAGUE_SEASON", targetId: season.id, metadata: { name: season.name } });
  revalidateLeague();
  return { success: true, id: season.id };
}

export async function setLeagueSeasonStatus(id: string, status: "DRAFT" | "ACTIVE" | "CLOSED") {
  const { adminId } = await requireAdmin();
  if (status === "ACTIVE") {
    const other = await prisma.leagueSeason.findFirst({ where: { status: "ACTIVE", id: { not: id } }, select: { name: true } });
    if (other) return { error: `Er is al een actief seizoen (${other.name}). Sluit dat eerst af.` };
  }
  await prisma.leagueSeason.update({ where: { id }, data: { status } });
  await logAdminAction({ adminId, action: "SET_LEAGUE_SEASON_STATUS", targetType: "LEAGUE_SEASON", targetId: id, metadata: { status } });
  revalidateLeague();
  return { success: true };
}

export async function deleteLeagueSeason(id: string) {
  const { adminId } = await requireAdmin();
  const count = await prisma.leagueResult.count({ where: { seasonId: id } });
  if (count > 0) return { error: `Dit seizoen heeft ${count} uitslagen. Sluit het af in plaats van verwijderen.` };
  await prisma.leagueSeason.delete({ where: { id } });
  await logAdminAction({ adminId, action: "DELETE_LEAGUE_SEASON", targetType: "LEAGUE_SEASON", targetId: id });
  revalidateLeague();
  return { success: true };
}

// ---------------------------------------------------------------- badges

export async function saveLeagueBadge(formData: FormData, existingId?: string | null) {
  const { adminId } = await requireAdmin();
  await ensureLeagueDefaults();
  const parsed = leagueBadgeSchema.safeParse(formDataToObject(formData, ["enabled"]));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const dup = await prisma.leagueBadge.findUnique({ where: { key: d.key }, select: { id: true } });
  if (dup && dup.id !== existingId) return { error: "Deze sleutel bestaat al" };
  const data = { key: d.key, name: d.name, description: d.description || null, color: d.color, criterion: d.criterion, threshold: d.threshold, sortOrder: d.sortOrder, enabled: d.enabled };
  const badge = existingId ? await prisma.leagueBadge.update({ where: { id: existingId }, data }) : await prisma.leagueBadge.create({ data });
  await logAdminAction({ adminId, action: "SAVE_LEAGUE_BADGE", targetType: "LEAGUE_BADGE", targetId: badge.id, metadata: { key: badge.key } });
  revalidateLeague();
  return { success: true };
}

export async function deleteLeagueBadge(id: string) {
  const { adminId } = await requireAdmin();
  await prisma.leagueBadge.delete({ where: { id } });
  await logAdminAction({ adminId, action: "DELETE_LEAGUE_BADGE", targetType: "LEAGUE_BADGE", targetId: id });
  revalidateLeague();
  return { success: true };
}

// ---------------------------------------------------------------- nieuws

export async function saveNewsPost(formData: FormData, existingId?: string | null) {
  const { adminId } = await requireAdmin();
  const parsed = newsPostSchema.safeParse(formDataToObject(formData, ["pinned"]));
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const cover = d.coverImage || null;
  if (cover && !cover.startsWith("/api/uploads/") && !cover.startsWith("/images/")) return { error: "Omslagfoto moet een geüpload bestand zijn" };
  const existing = existingId ? await prisma.newsPost.findUnique({ where: { id: existingId } }) : null;
  if (existingId && !existing) return { error: "Bericht niet gevonden" };
  const slug = existing && existing.title === d.title ? existing.slug : await uniqueSlug(d.title, existingId ?? undefined);
  const publishedAt = d.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : null;
  const data = { title: d.title, slug, excerpt: d.excerpt || null, body: d.body, coverImage: cover, pinned: d.pinned, status: d.status, publishedAt };
  const post = existing
    ? await prisma.newsPost.update({ where: { id: existing.id }, data })
    : await prisma.newsPost.create({ data: { ...data, authorId: adminId } });
  await logAdminAction({ adminId, action: "SAVE_NEWS_POST", targetType: "NEWS_POST", targetId: post.id, metadata: { status: post.status } });
  revalidateNews(post.slug);
  if (existing && existing.slug !== post.slug) revalidatePath(`/nieuws/${existing.slug}`);
  return { success: true, id: post.id };
}

export async function deleteNewsPost(id: string) {
  const { adminId } = await requireAdmin();
  const post = await prisma.newsPost.delete({ where: { id } }).catch(() => null);
  if (!post) return { error: "Bericht niet gevonden" };
  await logAdminAction({ adminId, action: "DELETE_NEWS_POST", targetType: "NEWS_POST", targetId: id });
  revalidateNews(post.slug);
  return { success: true };
}

export async function sendNewsletter(postId: string) {
  const { adminId } = await requireAdmin();
  const r = await sendNewsletterForPost(postId);
  if ("error" in r) return r;
  await logAdminAction({ adminId, action: "SEND_NEWSLETTER", targetType: "NEWS_POST", targetId: postId, metadata: { recipients: r.recipients } });
  revalidateNews();
  return { success: true, recipients: r.recipients };
}

// ---------------------------------------------------------------- moderatie

/** Interne notitie op een gebruiker (alleen staff/admin zien hem). */
export async function setInternalNote(userId: string, note: string) {
  const { adminId } = await requireAdmin();
  const parsed = internalNoteSchema.safeParse({ note });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  await prisma.user.update({ where: { id: userId }, data: { internalNote: parsed.data.note || null } });
  await logAdminAction({ adminId, action: "SET_INTERNAL_NOTE", targetType: "USER", targetId: userId, metadata: { length: parsed.data.note.length } });
  revalidatePath(`/dashboard/admin/users/${userId}`);
  return { success: true };
}
