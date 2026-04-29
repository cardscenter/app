"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { z } from "zod";

// ============================================================
// BLOCKING
// ============================================================

export async function blockUser(targetId: string, reason?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  if (targetId === session.user.id) return { error: "Je kunt jezelf niet blokkeren" };

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return { error: "Gebruiker niet gevonden" };

  // Idempotent — re-blocking a user is fine, just refreshes the row.
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
    create: {
      blockerId: session.user.id,
      blockedId: targetId,
      reason: reason?.trim() || null,
    },
    update: {
      reason: reason?.trim() || null,
    },
  });

  return { success: true };
}

export async function unblockUser(targetId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  await prisma.userBlock.deleteMany({
    where: { blockerId: session.user.id, blockedId: targetId },
  });

  return { success: true };
}

export async function getMyBlockedUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.userBlock.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      blocked: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });
}

export async function isUserBlocked(targetId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const row = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
  });
  return row !== null;
}

// ============================================================
// REPORTING
// ============================================================

const reportSchema = z.object({
  reason: z.enum(["SCAM", "SPAM", "HARASSMENT", "INAPPROPRIATE", "FAKE_LISTING", "OTHER"]),
  details: z.string().min(10, "Geef een duidelijke beschrijving (minimaal 10 tekens).").max(1000),
  evidenceUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

export async function reportUser(targetId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  if (targetId === session.user.id) return { error: "Je kunt jezelf niet rapporteren" };

  const parsed = reportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details"),
    evidenceUrl: formData.get("evidenceUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return { error: "Gebruiker niet gevonden" };

  // Rate limit: only one OPEN report per (reporter, reported) at a time.
  // Avoids the same user spam-filing multiple identical reports.
  const existingOpen = await prisma.userReport.findFirst({
    where: {
      reporterId: session.user.id,
      reportedId: targetId,
      status: { in: ["OPEN", "REVIEWING"] },
    },
  });
  if (existingOpen) {
    return { error: "Je hebt al een openstaande melding voor deze gebruiker." };
  }

  await prisma.userReport.create({
    data: {
      reporterId: session.user.id,
      reportedId: targetId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      evidenceUrl: parsed.data.evidenceUrl ?? null,
      status: "OPEN",
    },
  });

  return { success: true };
}

// ============================================================
// ADMIN
// ============================================================

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" as const };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true },
  });
  if (user?.accountType !== "ADMIN") return { error: "Niet geautoriseerd" as const };
  return { adminId: session.user.id };
}

export async function getReports(filter?: "OPEN" | "REVIEWING" | "DISMISSED" | "ACTION_TAKEN") {
  const adm = await requireAdmin();
  if ("error" in adm) return [];

  return prisma.userReport.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reporter: { select: { id: true, displayName: true } },
      reported: { select: { id: true, displayName: true, accountType: true } },
      reviewedBy: { select: { displayName: true } },
    },
  });
}

export async function reviewReport(
  reportId: string,
  action: "DISMISS" | "ACTION_TAKEN" | "REVIEWING",
  adminNote?: string
) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };

  const r = await prisma.userReport.findUnique({ where: { id: reportId } });
  if (!r) return { error: "Melding niet gevonden" };

  const newStatus =
    action === "DISMISS" ? "DISMISSED" : action === "ACTION_TAKEN" ? "ACTION_TAKEN" : "REVIEWING";

  await prisma.userReport.update({
    where: { id: reportId },
    data: {
      status: newStatus,
      reviewedById: adm.adminId,
      reviewedAt: new Date(),
      adminNote: adminNote?.trim() || null,
    },
  });

  // Notify the reporter when we close the loop. We DON'T notify the
  // reported user — that would defeat the moderation purpose.
  if (newStatus === "DISMISSED" || newStatus === "ACTION_TAKEN") {
    await createNotification(
      r.reporterId,
      "NEW_MESSAGE",
      newStatus === "ACTION_TAKEN" ? "Melding behandeld" : "Melding gesloten",
      newStatus === "ACTION_TAKEN"
        ? "Bedankt voor je melding. Onze moderators hebben actie ondernomen."
        : "Je melding is beoordeeld en gesloten zonder actie. Bedankt voor de moeite.",
      "/dashboard/meldingen"
    );
  }

  return { success: true };
}
