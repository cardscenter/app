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
  EVENT_BANNER_STORED_TYPE,
  EVENT_BANNER_MIN_DAYS,
  EVENT_BANNER_MAX_DAYS,
  calculateEventBannerCost,
  EVENT_SPOTLIGHT_STORED_TYPE,
  EVENT_SPOTLIGHT_MIN_DAYS,
  EVENT_SPOTLIGHT_MAX_DAYS,
  calculateEventSpotlightCost,
} from "@/lib/events/upsell-config";
import { FACILITY_KEYS, ACTIVITY_KEYS, type TicketType } from "@/lib/events/types";

interface DuplicateMatch {
  id: string;
  title: string;
  city: string;
  startTime: string;
}

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
      OR: [{ city: { equals: city } }, { postalCode: { equals: postalCode } }],
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

function parseGalleryImages(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}

// Ook gebruikt voor standhouder-opties (zelfde naam/prijs-shape). Die zijn
// huurprijzen, geen tickets — daar mag géén serviceFee aan hangen
// (allowServiceFee=false, anti-tamper voor direct-gepostte payloads).
function parseTicketTypes(raw: string | undefined, allowServiceFee = true): TicketType[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<{ name?: unknown; price?: unknown; description?: unknown; serviceFee?: unknown }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => typeof t?.name === "string" && (t.name as string).trim().length > 0 && Number.isFinite(Number(t.price)))
      .map((t) => {
        const out: TicketType = { name: (t.name as string).trim().slice(0, 60), price: Math.max(0, Number(t.price)) };
        if (typeof t.description === "string" && t.description.trim()) out.description = t.description.trim().slice(0, 200);
        if (allowServiceFee && Number.isFinite(Number(t.serviceFee)) && Number(t.serviceFee) > 0) out.serviceFee = Math.max(0, Number(t.serviceFee));
        return out;
      })
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  const verified = await requireEmailVerified(userId);
  if ("error" in verified) {
    return {
      error:
        "Bevestig eerst je e-mailadres voordat je een evenement kunt aanmaken. Check je inbox of vraag een nieuwe verificatiemail aan in je dashboard.",
    };
  }

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
    organizerName: formData.get("organizerName") || undefined,
    organizerWebsite: formData.get("organizerWebsite") || undefined,
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate") || undefined,
    endTime: formData.get("endTime"),
    entryType: formData.get("entryType") || "PAID",
    ticketTypes: formData.get("ticketTypes") || undefined,
    ticketSaleMode: formData.get("ticketSaleMode") || undefined,
    earlyAccessTime: formData.get("earlyAccessTime") || undefined,
    registrationUrl: formData.get("registrationUrl") || undefined,
    vendorOptions: formData.get("vendorOptions") || undefined,
    vendorInfo: formData.get("vendorInfo") || undefined,
    canPlay: formData.get("canPlay") || undefined,
    canTrade: formData.get("canTrade") || undefined,
    canSell: formData.get("canSell") || undefined,
    hasParking: formData.get("hasParking") || undefined,
    hasFood: formData.get("hasFood") || undefined,
    hasToilets: formData.get("hasToilets") || undefined,
    hasWifi: formData.get("hasWifi") || undefined,
    cardPayment: formData.get("cardPayment") || undefined,
    wheelchairAccessible: formData.get("wheelchairAccessible") || undefined,
    hasCloakroom: formData.get("hasCloakroom") || undefined,
    childFriendly: formData.get("childFriendly") || undefined,
    maxVisitors: formData.get("maxVisitors") || undefined,
    totalTables: formData.get("totalTables") || undefined,
    coverImage: formData.get("coverImage") || undefined,
    flyerImage: formData.get("flyerImage") || undefined,
    galleryImages: formData.get("galleryImages") || undefined,
    videoUrl: formData.get("videoUrl") || undefined,
    tournamentFormat: formData.get("tournamentFormat") || undefined,
    isSanctioned: formData.get("isSanctioned") || undefined,
    prizePool: formData.get("prizePool") || undefined,
    promote: formData.get("promote") || undefined,
    promoteDays: formData.get("promoteDays") || undefined,
    spotlight: formData.get("spotlight") || undefined,
    spotlightDays: formData.get("spotlightDays") || undefined,
  };

  const parsed = createEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  }
  const data = parsed.data;

  const timezone = timezoneForCountry(data.country);
  const startTime = zonedWallClockToUtc(data.startDate, data.startTime, timezone);
  const endTime = zonedWallClockToUtc(data.endDate || data.startDate, data.endTime, timezone);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { error: "Ongeldige datum/tijd" };
  }
  if (endTime.getTime() <= Date.now()) {
    return { error: "Dit event ligt in het verleden" };
  }
  // Vroege toegang (VT) — zelfde dag als de start, alleen voor betaalde events.
  const earlyAccessTime =
    data.entryType === "PAID" && data.earlyAccessTime
      ? zonedWallClockToUtc(data.startDate, data.earlyAccessTime, timezone)
      : null;

  const confirmDuplicate = formData.get("confirmDuplicate") === "1";
  if (!confirmDuplicate) {
    const duplicates = await findDuplicateEvents(startTime, data.city, data.postalCode);
    if (duplicates.length > 0) return { duplicateWarning: duplicates };
  }

  // Tickets + standhouder-opties (beide zelf-gedefinieerde naam/prijs-lijsten).
  const isPaid = data.entryType === "PAID";
  // Tickets oplopend op prijs tonen.
  const ticketTypes = (isPaid ? parseTicketTypes(data.ticketTypes) : []).sort((a, b) => a.price - b.price);
  const vendorOptions = parseTicketTypes(data.vendorOptions, false);
  const galleryImages = parseGalleryImages(data.galleryImages);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, reservedBalance: true, accountType: true, isTrustedEventOrganizer: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Promotie uit saldo — twee mogelijke upsells: de banner op de
  // evenementenpagina (CATEGORY_HIGHLIGHT) en/of de homepage-spotlight
  // (HOMEPAGE_SPOTLIGHT). Server-side anti-tamper hercheck van dagen + kosten.
  const wantsPromo = data.promote && (data.promoteDays ?? 0) > 0;
  const promoDays = wantsPromo
    ? Math.max(EVENT_BANNER_MIN_DAYS, Math.min(data.promoteDays ?? 0, EVENT_BANNER_MAX_DAYS))
    : 0;
  const promoCost = wantsPromo ? calculateEventBannerCost(promoDays, user.accountType) : 0;

  const wantsSpotlight = data.spotlight && (data.spotlightDays ?? 0) > 0;
  const spotlightDays = wantsSpotlight
    ? Math.max(EVENT_SPOTLIGHT_MIN_DAYS, Math.min(data.spotlightDays ?? 0, EVENT_SPOTLIGHT_MAX_DAYS))
    : 0;
  const spotlightCost = wantsSpotlight ? calculateEventSpotlightCost(spotlightDays, user.accountType) : 0;

  const promoItems: Array<{ type: string; days: number; cost: number; label: string }> = [];
  if (promoCost > 0) promoItems.push({ type: EVENT_BANNER_STORED_TYPE, days: promoDays, cost: promoCost, label: "Uitgelichte banner evenement" });
  if (spotlightCost > 0) promoItems.push({ type: EVENT_SPOTLIGHT_STORED_TYPE, days: spotlightDays, cost: spotlightCost, label: "Homepage-spotlight evenement" });

  const totalPromoCost = Math.round((promoCost + spotlightCost) * 100) / 100;
  if (totalPromoCost > 0) {
    const available = user.balance - user.reservedBalance;
    if (available < totalPromoCost) {
      return { error: `Onvoldoende beschikbaar saldo voor de promotie. Benodigd: €${totalPromoCost.toFixed(2)}, beschikbaar: €${available.toFixed(2)}` };
    }
  }

  const geo = await geocodeAddress({
    street: data.street,
    houseNumber: data.houseNumber,
    postalCode: data.postalCode,
    city: data.city,
    country: data.country,
  });

  const autoPublish = user.isTrustedEventOrganizer;
  const status = autoPublish ? "LIVE" : "PENDING";

  // Facility-/activity-booleans uit de geparste data.
  const facilityData: Record<string, boolean> = {};
  for (const key of [...ACTIVITY_KEYS, ...FACILITY_KEYS]) {
    facilityData[key] = Boolean((data as Record<string, unknown>)[key]);
  }

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
        earlyAccessTime,
        entryType: data.entryType,
        entryPriceMode: "TIERS",
        entryPrice: null,
        entryCurrency: isPaid ? "EUR" : null,
        ticketTypes: isPaid && ticketTypes.length > 0 ? JSON.stringify(ticketTypes) : null,
        childrenFreeUntilAge: null,
        vendorOptions: vendorOptions.length > 0 ? JSON.stringify(vendorOptions) : null,
        vendorInfo: data.vendorInfo || null,
        ...facilityData,
        maxVisitors: data.maxVisitors ?? null,
        totalTables: data.totalTables ?? null,
        registrationUrl: data.registrationUrl || null,
        coverImage: data.coverImage || null,
        flyerImage: data.flyerImage || null,
        galleryImages: galleryImages.length > 0 ? JSON.stringify(galleryImages) : null,
        videoUrl: data.videoUrl || null,
        organizerName: data.organizerName?.trim() || null,
        organizerWebsite: data.organizerWebsite || null,
        tournamentFormat: data.tournamentFormat ?? null,
        isSanctioned: data.isSanctioned,
        prizePool: data.prizePool ?? null,
      },
    });

    if (promoItems.length > 0) {
      const now = new Date();
      let running = user.balance;
      for (const item of promoItems) {
        await tx.eventUpsell.create({
          data: {
            eventId: newEvent.id,
            type: item.type,
            startsAt: now,
            expiresAt: new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000),
            dailyCost: item.cost / item.days,
            totalCost: item.cost,
          },
        });

        const balanceBefore = running;
        const balanceAfter = Math.round((balanceBefore - item.cost) * 100) / 100;
        running = balanceAfter;
        await tx.transaction.create({
          data: {
            userId,
            type: "FEE",
            amount: -item.cost,
            balanceBefore,
            balanceAfter,
            description: `${item.label} (${item.days} dagen)`,
          },
        });
      }
      await tx.user.update({ where: { id: userId }, data: { balance: running } });
    }

    return newEvent;
  });

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
    const admins = await prisma.user.findMany({ where: { accountType: "ADMIN" }, select: { id: true } });
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
      organizerId: true, status: true, country: true, timezone: true,
      startTime: true, endTime: true, street: true, houseNumber: true,
      postalCode: true, city: true,
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige gegevens" };
  const data = parsed.data;

  const updateData: Record<string, unknown> = {};
  for (const key of ["title", "description", "venueName", "street", "houseNumber", "postalCode", "city", "country", "registrationUrl", "coverImage"] as const) {
    if (data[key] !== undefined) updateData[key] = data[key] || null;
  }

  const newCountry = data.country ?? event.country;
  const addressChanged =
    data.street !== undefined || data.houseNumber !== undefined ||
    data.postalCode !== undefined || data.city !== undefined || data.country !== undefined;
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

  await prisma.event.update({ where: { id: eventId }, data: { status: "DELETED" } });
  revalidatePath("/evenementen");
  revalidatePath("/dashboard/evenementen");
  return { success: true };
}

function toLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function toLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
