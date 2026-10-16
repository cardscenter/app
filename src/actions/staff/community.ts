"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/roles-server";
import { leagueResultSchema } from "@/lib/validations/community";
import { firstZodError } from "@/lib/validations/shop-event";
import { upsertResult, deleteResult } from "@/lib/community/league";
import { addStamp, addPoints, redeemPoints, searchPlayers, getLoyaltySummary } from "@/lib/community/loyalty";

/**
 * Staff-acties Community Hub Fase 5: uitslagen invoeren, stempels en punten
 * bijschrijven of inwisselen aan de kassa. `requireStaff` leest de rol vers.
 */

async function staffId(): Promise<string | null> {
  try {
    return (await requireStaff()).userId;
  } catch {
    return null;
  }
}

function revalidateLeague() {
  revalidatePath("/league");
  revalidatePath("/dashboard/league");
  revalidatePath("/dashboard/staff/league");
}

export async function saveLeagueResult(input: unknown) {
  const sid = await staffId();
  if (!sid) return { error: "Geen toegang" };
  const parsed = leagueResultSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const r = await upsertResult({ ...d, note: d.note || null, enteredById: sid });
  if ("error" in r) return r;
  revalidateLeague();
  return { success: true, points: r.points };
}

export async function removeLeagueResult(id: string) {
  const sid = await staffId();
  if (!sid) return { error: "Geen toegang" };
  await deleteResult(id);
  revalidateLeague();
  return { success: true };
}

export async function findPlayers(q: string) {
  const sid = await staffId();
  if (!sid) return [];
  return searchPlayers(q);
}

export async function getPlayerLoyalty(userId: string) {
  const sid = await staffId();
  if (!sid) return null;
  const [summary, user] = await Promise.all([getLoyaltySummary(userId), prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, firstName: true, lastName: true, avatarUrl: true } })]);
  if (!user) return null;
  return { user: { id: userId, ...user }, ...summary };
}

export async function giveStamp(userId: string, reason: string) {
  const sid = await staffId();
  if (!sid) return { error: "Geen toegang" };
  const r = await addStamp({ userId, reason: reason.trim() || "Stempel aan de bar", source: "STAFF", staffId: sid });
  revalidatePath("/dashboard/league");
  return { success: true, ...r };
}

export async function givePoints(userId: string, points: number, reason: string) {
  const sid = await staffId();
  if (!sid) return { error: "Geen toegang" };
  if (!Number.isFinite(points) || points <= 0 || points > 1000) return { error: "Aantal punten tussen 1 en 1000" };
  await addPoints({ userId, delta: points, reason: reason.trim() || "Punten aan de bar", source: "STAFF", staffId: sid });
  revalidatePath("/dashboard/league");
  return { success: true };
}

export async function redeemPlayerPoints(userId: string, points: number, reason: string) {
  const sid = await staffId();
  if (!sid) return { error: "Geen toegang" };
  const r = await redeemPoints({ userId, points, reason: reason.trim() || "Ingewisseld aan de kassa", staffId: sid });
  if ("error" in r) return r;
  revalidatePath("/dashboard/league");
  return { success: true, balance: r.balance };
}
