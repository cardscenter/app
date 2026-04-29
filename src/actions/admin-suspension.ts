"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notification";
import { z } from "zod";

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

const suspendSchema = z.object({
  type: z.enum(["TEMPORARY", "PERMANENT"]),
  reason: z.string().min(5, "Reden is verplicht (min. 5 tekens)").max(500),
  // For TEMPORARY: number of days (1-365). Ignored for PERMANENT.
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function suspendUser(targetId: string, formData: FormData) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };
  if (targetId === adm.adminId) return { error: "Je kunt jezelf niet opschorten" };

  const parsed = suspendSchema.safeParse({
    type: formData.get("type"),
    reason: formData.get("reason"),
    days: formData.get("days") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, accountType: true, displayName: true },
  });
  if (!target) return { error: "Gebruiker niet gevonden" };
  if (target.accountType === "ADMIN") {
    return { error: "Admins kunnen niet via deze flow opgeschort worden" };
  }

  let suspendedUntil: Date;
  if (parsed.data.type === "PERMANENT") {
    // Sentinel datum ver in de toekomst — isUserSuspended kijkt primair naar
    // suspensionType="PERMANENT", maar dit houdt date-based queries simpel.
    suspendedUntil = new Date("2999-12-31T23:59:59Z");
  } else {
    if (!parsed.data.days) return { error: "Aantal dagen vereist voor TEMPORARY-opschorting" };
    suspendedUntil = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);
  }

  await prisma.user.update({
    where: { id: targetId },
    data: {
      suspendedUntil,
      suspensionType: parsed.data.type,
      suspensionReason: parsed.data.reason,
      suspensionAdminId: adm.adminId,
    },
  });

  await createNotification(
    targetId,
    "NEW_MESSAGE",
    "Account opgeschort",
    parsed.data.type === "PERMANENT"
      ? `Je account is permanent opgeschort. Reden: ${parsed.data.reason}`
      : `Je account is opgeschort tot ${suspendedUntil.toLocaleDateString("nl-NL")}. Reden: ${parsed.data.reason}`,
    "/dashboard/meldingen"
  );

  return { success: true };
}

export async function liftSuspension(targetId: string) {
  const adm = await requireAdmin();
  if ("error" in adm) return { error: adm.error };

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { displayName: true, suspendedUntil: true },
  });
  if (!target) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: targetId },
    data: {
      suspendedUntil: null,
      suspensionType: null,
      suspensionReason: null,
      suspensionAdminId: null,
    },
  });

  await createNotification(
    targetId,
    "NEW_MESSAGE",
    "Opschorting opgeheven",
    "Je account-opschorting is opgeheven. Je kunt het platform weer normaal gebruiken.",
    "/dashboard"
  );

  return { success: true };
}

export async function getSuspendedUsers() {
  const adm = await requireAdmin();
  if ("error" in adm) return [];

  const now = new Date();
  return prisma.user.findMany({
    where: {
      OR: [
        { suspensionType: "PERMANENT" },
        { suspendedUntil: { gt: now } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      accountType: true,
      suspendedUntil: true,
      suspensionType: true,
      suspensionReason: true,
      suspensionAdminId: true,
    },
    orderBy: { suspendedUntil: "asc" },
  });
}
