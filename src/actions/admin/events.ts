"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/actions/notification";
import { revalidatePath } from "next/cache";
import { geocodeAddress } from "@/lib/events/geocoding";

export async function approveEvent(eventId: string) {
  const { adminId } = await requireAdmin();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      organizerId: true,
      status: true,
      lat: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });
  if (!event) return { error: "Evenement niet gevonden" };
  if (event.status !== "PENDING") return { error: "Evenement staat niet in de wachtrij" };

  // Opnieuw geocoden als de eerste poging faalde (fail-soft).
  let geoUpdate: { lat: number; lng: number } | null = null;
  if (event.lat === null) {
    geoUpdate = await geocodeAddress({
      street: event.street,
      houseNumber: event.houseNumber,
      postalCode: event.postalCode,
      city: event.city,
      country: event.country,
    });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "LIVE",
      publishedAt: new Date(),
      reviewedById: adminId,
      reviewedAt: new Date(),
      rejectionReason: null,
      ...(geoUpdate ? { lat: geoUpdate.lat, lng: geoUpdate.lng } : {}),
    },
  });

  await createNotification(
    event.organizerId,
    "EVENT_APPROVED",
    "Evenement goedgekeurd",
    `Je evenement "${event.title}" is goedgekeurd en staat nu live.`,
    `/evenementen/${event.id}`,
  );

  await logAdminAction({
    adminId,
    action: "APPROVE_EVENT",
    targetType: "EVENT",
    targetId: eventId,
    metadata: { title: event.title },
  });

  revalidatePath("/dashboard/admin/event-approvals");
  revalidatePath("/evenementen");
  return { success: true };
}

export async function rejectEvent(eventId: string, reason: string) {
  const { adminId } = await requireAdmin();

  const trimmed = reason?.trim();
  if (!trimmed || trimmed.length < 5) return { error: "Reden minimaal 5 tekens" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, organizerId: true, status: true },
  });
  if (!event) return { error: "Evenement niet gevonden" };
  if (event.status !== "PENDING") return { error: "Evenement staat niet in de wachtrij" };

  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: "REJECTED",
      rejectionReason: trimmed,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });

  await createNotification(
    event.organizerId,
    "EVENT_REJECTED",
    "Evenement afgewezen",
    `Je evenement "${event.title}" is afgewezen. Reden: ${trimmed}`,
    `/dashboard/evenementen`,
  );

  await logAdminAction({
    adminId,
    action: "REJECT_EVENT",
    targetType: "EVENT",
    targetId: eventId,
    metadata: { title: event.title, reason: trimmed },
  });

  revalidatePath("/dashboard/admin/event-approvals");
  return { success: true };
}

export async function setEventOfficial(eventId: string, official: boolean) {
  const { adminId } = await requireAdmin();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) return { error: "Evenement niet gevonden" };

  await prisma.event.update({
    where: { id: eventId },
    data: { isOfficial: official },
  });

  await logAdminAction({
    adminId,
    action: "SET_EVENT_OFFICIAL",
    targetType: "EVENT",
    targetId: eventId,
    metadata: { title: event.title, official },
  });

  revalidatePath("/dashboard/admin/event-approvals");
  revalidatePath(`/evenementen/${eventId}`);
  return { success: true };
}

export async function setTrustedOrganizer(userId: string, trusted: boolean) {
  const { adminId } = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, isTrustedEventOrganizer: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  await prisma.user.update({
    where: { id: userId },
    data: { isTrustedEventOrganizer: trusted },
  });

  if (trusted) {
    await createNotification(
      userId,
      "TRUSTED_ORGANIZER",
      "Vertrouwde organisator",
      "Je bent aangewezen als vertrouwde organisator — je evenementen worden voortaan direct gepubliceerd.",
      `/dashboard/evenementen`,
    );
  }

  await logAdminAction({
    adminId,
    action: trusted ? "GRANT_TRUSTED_ORGANIZER" : "REVOKE_TRUSTED_ORGANIZER",
    targetType: "USER",
    targetId: userId,
    metadata: { displayName: user.displayName },
  });

  revalidatePath("/dashboard/admin/event-approvals");
  return { success: true };
}

export async function reviewEventReport(
  reportId: string,
  action: "DISMISS" | "ACTION_TAKEN",
  adminNote?: string,
) {
  const { adminId } = await requireAdmin();

  const report = await prisma.eventReport.findUnique({
    where: { id: reportId },
    select: { id: true, eventId: true, status: true },
  });
  if (!report) return { error: "Melding niet gevonden" };
  if (report.status === "DISMISSED" || report.status === "ACTION_TAKEN") {
    return { error: "Melding is al afgehandeld" };
  }

  await prisma.eventReport.update({
    where: { id: reportId },
    data: {
      status: action === "DISMISS" ? "DISMISSED" : "ACTION_TAKEN",
      reviewedById: adminId,
      reviewedAt: new Date(),
      adminNote: adminNote?.trim() || null,
    },
  });

  // Bij ACTION_TAKEN: het event uit publicatie halen (verbergen).
  if (action === "ACTION_TAKEN") {
    await prisma.event.update({
      where: { id: report.eventId },
      data: { status: "DELETED" },
    });
    revalidatePath("/evenementen");
  }

  await logAdminAction({
    adminId,
    action: "REVIEW_EVENT_REPORT",
    targetType: "EVENT_REPORT",
    targetId: reportId,
    metadata: { decision: action },
  });

  revalidatePath("/dashboard/admin/event-reports");
  return { success: true };
}
