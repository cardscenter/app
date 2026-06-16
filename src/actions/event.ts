"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createEventSchema, updateEventSchema } from "@/lib/validations/event";
import { createNotification } from "@/actions/notification";
import { requireNotSuspended } from "@/lib/suspension";
import { requireEmailVerified } from "@/lib/email-verification";
import { timezoneForCountry, zonedWallClockToUtc } from "@/lib/events/timezones";
import { geocodeAddress } from "@/lib/events/geocoding";
import {
  availableEventLabelsFor,
  calculateEventLabelCost,
  isValidEventLabelType,
  isValidLabelColor,
  MAX_LABELS_PER_EVENT,
  type EventLabelType,
  type LabelColor,
} from "@/lib/events/labels";
import {
  calculateEventUpsellCost,
  isEventUpsellType,
  type EventUpsellType,
} from "@/lib/events/upsell-config";

interface DuplicateMatch {
  id: string;
  title: string;
  city: string;
  startTime: string;
}

/**
 * Simpele dubbel-detectie: bestaand LIVE/PENDING event op dezelfde kalenderdag
 * in dezelfde plaats of postcode. Blokkeert niet — geeft een waarschuwing die
 * de wizard toont; de organisator kan "toch publiceren".
 */
async function findDuplicateEvents(
  startTime: Date,
  city: string,
  postalCode: string,
  excludeId?: string,
): Promise<DuplicateMatch[]> {
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);

  const matches = await prisma.event.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ["PENDING", "LIVE"] },
      startTime: { gte: dayStart, lte: dayEnd },
      OR: [
        { city: { equals: city } },
        { postalCode: { equals: postalCode } },
      ],
    },
    select: { id: true, title: true, city: true, startTime: true },
    take: 5,
  });

  return matches.map((m) => ({
    id: m.id,
    title: m.title,
    city: m.city,
    startTime: m.startTime.toISOString(),
  }));
}

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  const verified = await requireEmailVerified(userId);
  if ("error" in verified) return { error: verified.error };

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    eventType: formData.get("eventType"),
    venueName: formData.get("venueName"),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    country: formData.get("country"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate") || undefined,
    endTime: formData.get("endTime"),
    entryType: formData.get("entryType") || "FREE",
    entryPrice: formData.get("entryPrice") || undefined,
    entryCurrency: formData.get("entryCurrency") || undefined,
    canPlay: formData.get("canPlay") || undefined,
    canTrade: formData.get("canTrade") || undefined,
    canSell: formData.get("canSell") || undefined,
    hasParking: formData.get("hasParking") || undefined,
    hasFood: formData.get("hasFood") || undefined,
    maxVisitors: formData.get("maxVisitors") || undefined,
    registrationRequired: formData.get("registrationRequired") || undefined,
    registrationUrl: formData.get("registrationUrl") || undefined,
    coverImage: formData.get("coverImage") || undefined,
    tournamentFormat: formData.get("tournamentFormat") || undefined,
    isSanctioned: formData.get("isSanctioned") || undefined,
    prizePool: formData.get("prizePool") || undefined,
    labels: formData.get("labels") || undefined,
    upsells: formData.get("upsells") || undefined,
  };

  const parsed = createEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  }
  const data = parsed.data;

  // Tijdzone uit land + UTC-conversie van de event-lokale wandklok-tijd.
  const timezone = timezoneForCountry(data.country);
  const startTime = zonedWallClockToUtc(data.startDate, data.startTime, timezone);
  const endTime = zonedWallClockToUtc(
    data.endDate || data.startDate,
    data.endTime,
    timezone,
  );
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { error: "Ongeldige datum/tijd" };
  }
  if (endTime.getTime() <= Date.now()) {
    return { error: "Dit event ligt in het verleden" };
  }

  // Dubbel-detectie (waarschuwing, niet blokkerend).
  const confirmDuplicate = formData.get("confirmDuplicate") === "1";
  if (!confirmDuplicate) {
    const duplicates = await findDuplicateEvents(startTime, data.city, data.postalCode);
    if (duplicates.length > 0) {
      return { duplicateWarning: duplicates };
    }
  }

  // Promotie: upsells + labels (betaald uit saldo, geen tier-gratis-quota).
  let upsellEntries: { type: EventUpsellType; days: number }[] = [];
  if (data.upsells) {
    try {
      const rawUpsells = JSON.parse(data.upsells) as Array<{ type: string; days: number }>;
      upsellEntries = rawUpsells
        .filter((u) => isEventUpsellType(u?.type) && Number(u?.days) > 0)
        .map((u) => ({ type: u.type as EventUpsellType, days: Math.min(Number(u.days), 60) }));
    } catch {
      return { error: "Ongeldige promotie-gegevens" };
    }
  }

  // Labels parsen + anti-tamper hercheck.
  let parsedLabels: { type: EventLabelType; colorKey: LabelColor }[] = [];
  if (data.labels) {
    try {
      const rawLabels = JSON.parse(data.labels) as Array<{ type: string; colorKey: string }>;
      const cleaned = rawLabels
        .filter(
          (l) =>
            isValidEventLabelType(l?.type) && isValidLabelColor(l?.colorKey),
        )
        .slice(0, MAX_LABELS_PER_EVENT) as { type: EventLabelType; colorKey: LabelColor }[];

      const availability = availableEventLabelsFor({
        entryType: data.entryType,
        isSanctioned: data.isSanctioned,
        maxVisitors: data.maxVisitors ?? null,
        canTrade: data.canTrade,
      });
      const availSet = new Set(availability.filter((a) => a.available).map((a) => a.type));
      for (const l of cleaned) {
        if (!availSet.has(l.type)) {
          return { error: `Label "${l.type}" is niet beschikbaar voor dit event` };
        }
      }
      const seen = new Set<EventLabelType>();
      parsedLabels = cleaned.filter((l) => {
        if (seen.has(l.type)) return false;
        seen.add(l.type);
        return true;
      });
    } catch {
      parsedLabels = [];
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      balance: true,
      reservedBalance: true,
      accountType: true,
      isTrustedEventOrganizer: true,
    },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const perUpsellCost = upsellEntries.map((e) =>
    calculateEventUpsellCost(e.type, e.days, user.accountType),
  );
  const totalUpsellCost = Math.round(perUpsellCost.reduce((s, c) => s + c, 0) * 100) / 100;
  const labelsCost = calculateEventLabelCost(parsedLabels.length);
  const totalPromotionCost = Math.round((totalUpsellCost + labelsCost) * 100) / 100;

  if (totalPromotionCost > 0) {
    const available = user.balance - user.reservedBalance;
    if (available < totalPromotionCost) {
      return {
        error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalPromotionCost.toFixed(2)}, beschikbaar: €${available.toFixed(2)}`,
      };
    }
  }

  // Geocode (fail-soft → null bij fout/timeout).
  const geo = await geocodeAddress({
    street: data.street,
    houseNumber: data.houseNumber,
    postalCode: data.postalCode,
    city: data.city,
    country: data.country,
  });

  // Trusted organisator → direct LIVE; anders approval-wachtrij.
  const autoPublish = user.isTrustedEventOrganizer;
  const status = autoPublish ? "LIVE" : "PENDING";

  const event = await prisma.$transaction(async (tx) => {
    const newEvent = await tx.event.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        eventType: data.eventType,
        organizerId: userId,
        status,
        publishedAt: autoPublish ? new Date() : null,
        reviewedAt: autoPublish ? new Date() : null,
        venueName: data.venueName,
        street: data.street,
        houseNumber: data.houseNumber,
        postalCode: data.postalCode,
        city: data.city,
        country: data.country,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        timezone,
        startTime,
        endTime,
        entryType: data.entryType,
        entryPrice: data.entryType === "PAID" ? data.entryPrice ?? null : null,
        entryCurrency: data.entryType === "PAID" ? data.entryCurrency ?? null : null,
        canPlay: data.canPlay,
        canTrade: data.canTrade,
        canSell: data.canSell,
        hasParking: data.hasParking,
        hasFood: data.hasFood,
        maxVisitors: data.maxVisitors ?? null,
        registrationRequired: data.registrationRequired,
        registrationUrl: data.registrationUrl || null,
        coverImage: data.coverImage || null,
        tournamentFormat: data.tournamentFormat ?? null,
        isSanctioned: data.isSanctioned,
        prizePool: data.prizePool ?? null,
      },
    });

    if (upsellEntries.length > 0) {
      const now = new Date();
      for (let i = 0; i < upsellEntries.length; i++) {
        const entry = upsellEntries[i];
        const cost = perUpsellCost[i];
        await tx.eventUpsell.create({
          data: {
            eventId: newEvent.id,
            type: entry.type,
            startsAt: now,
            expiresAt: new Date(now.getTime() + entry.days * 24 * 60 * 60 * 1000),
            dailyCost: entry.days > 0 ? cost / entry.days : cost,
            totalCost: cost,
          },
        });
      }
    }

    if (parsedLabels.length > 0) {
      const perLabelCost = labelsCost / parsedLabels.length;
      await tx.eventLabel.createMany({
        data: parsedLabels.map((l) => ({
          eventId: newEvent.id,
          type: l.type,
          colorKey: l.colorKey,
          cost: Math.round(perLabelCost * 100) / 100,
        })),
      });
    }

    if (totalPromotionCost > 0) {
      const balanceBefore = user.balance;
      const balanceAfter = Math.round((balanceBefore - totalPromotionCost) * 100) / 100;
      await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });

      const parts: string[] = [];
      if (upsellEntries.length > 0) parts.push(upsellEntries.map((e) => e.type).join(", "));
      if (parsedLabels.length > 0) {
        parts.push(`${parsedLabels.length} label${parsedLabels.length === 1 ? "" : "s"}`);
      }
      await tx.transaction.create({
        data: {
          userId,
          type: "FEE",
          amount: -totalPromotionCost,
          balanceBefore,
          balanceAfter,
          description: `Promotiekosten evenement: ${parts.join(" + ")}`,
        },
      });
    }

    return newEvent;
  });

  // Notificaties.
  if (autoPublish) {
    await createNotification(
      userId,
      "EVENT_PUBLISHED",
      "Evenement live",
      `Je evenement "${event.title}" staat live in de kalender.`,
      `/evenementen/${event.id}`,
    );
  } else {
    await createNotification(
      userId,
      "EVENT_SUBMITTED",
      "Evenement ingediend",
      `Je evenement "${event.title}" is ingediend en wordt beoordeeld voordat het zichtbaar wordt.`,
      `/dashboard/evenementen`,
    );
    // Admins op de hoogte stellen van nieuw werk in de wachtrij.
    const admins = await prisma.user.findMany({
      where: { accountType: "ADMIN" },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        createNotification(
          a.id,
          "EVENT_PENDING_REVIEW",
          "Nieuw evenement ter beoordeling",
          `"${event.title}" wacht op goedkeuring.`,
          `/dashboard/admin/event-approvals`,
        ),
      ),
    );
  }

  revalidatePath("/evenementen");
  revalidatePath("/dashboard/evenementen");

  return { success: true, eventId: event.id, status };
}

export async function updateEvent(eventId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerId: true,
      status: true,
      country: true,
      timezone: true,
      startTime: true,
      endTime: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
    },
  });
  if (!event) return { error: "Evenement niet gevonden" };
  if (event.organizerId !== userId) return { error: "Niet bevoegd" };
  if (event.status === "ENDED" || event.status === "DELETED") {
    return { error: "Dit evenement kan niet meer worden bewerkt" };
  }

  const raw = {
    title: formData.get("title") || undefined,
    description: formData.get("description") ?? undefined,
    venueName: formData.get("venueName") || undefined,
    street: formData.get("street") || undefined,
    houseNumber: formData.get("houseNumber") || undefined,
    postalCode: formData.get("postalCode") || undefined,
    city: formData.get("city") || undefined,
    country: formData.get("country") || undefined,
    startDate: formData.get("startDate") || undefined,
    startTime: formData.get("startTime") || undefined,
    endDate: formData.get("endDate") || undefined,
    endTime: formData.get("endTime") || undefined,
    registrationUrl: formData.get("registrationUrl") ?? undefined,
    coverImage: formData.get("coverImage") ?? undefined,
  };
  const parsed = updateEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  }
  const data = parsed.data;

  const updateData: Record<string, unknown> = {};
  for (const key of ["title", "description", "venueName", "street", "houseNumber", "postalCode", "city", "country", "registrationUrl", "coverImage"] as const) {
    if (data[key] !== undefined) updateData[key] = data[key] || null;
  }

  // Adres gewijzigd → opnieuw geocoden + tijdzone herbepalen.
  const newCountry = data.country ?? event.country;
  const addressChanged =
    data.street !== undefined ||
    data.houseNumber !== undefined ||
    data.postalCode !== undefined ||
    data.city !== undefined ||
    data.country !== undefined;
  if (addressChanged) {
    const timezone = timezoneForCountry(newCountry);
    updateData.timezone = timezone;
    const geo = await geocodeAddress({
      street: data.street ?? event.street,
      houseNumber: data.houseNumber ?? event.houseNumber,
      postalCode: data.postalCode ?? event.postalCode,
      city: data.city ?? event.city,
      country: newCountry,
    });
    updateData.lat = geo?.lat ?? null;
    updateData.lng = geo?.lng ?? null;
  }

  // Tijd gewijzigd → herbereken UTC.
  if (data.startDate || data.startTime || data.endDate || data.endTime) {
    const timezone = (updateData.timezone as string) ?? event.timezone;
    const startDate = data.startDate ?? toLocalDate(event.startTime, timezone);
    const startTimeStr = data.startTime ?? toLocalTime(event.startTime, timezone);
    const endDateStr = data.endDate ?? data.startDate ?? toLocalDate(event.endTime, timezone);
    const endTimeStr = data.endTime ?? toLocalTime(event.endTime, timezone);
    const newStart = zonedWallClockToUtc(startDate, startTimeStr, timezone);
    const newEnd = zonedWallClockToUtc(endDateStr, endTimeStr, timezone);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime()) || newEnd <= newStart) {
      return { error: "Ongeldige datum/tijd" };
    }
    updateData.startTime = newStart;
    updateData.endTime = newEnd;
  }

  await prisma.event.update({ where: { id: eventId }, data: updateData });

  revalidatePath(`/evenementen/${eventId}`);
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (!event) return { error: "Evenement niet gevonden" };
  if (event.organizerId !== session.user.id) return { error: "Niet bevoegd" };

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "DELETED" },
  });

  revalidatePath("/evenementen");
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}

// Helpers om een UTC-Date terug te formatteren naar wandklok-strings in tz.
function toLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function toLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
