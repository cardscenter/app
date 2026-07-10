import type { Event } from "@prisma/client";
import type { EventFormState, NamePriceInput } from "@/components/events/event-form-types";
import { INITIAL_EVENT_FORM } from "@/components/events/event-form-types";
import type { EventType } from "@/lib/events/types";

// UTC → event-lokale wandklok (gedeeld met updateEvent in src/actions/event.ts).
export function toLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function toLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function parseNamePriceList(raw: string | null): NamePriceInput[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<{ name?: unknown; price?: unknown; description?: unknown; serviceFee?: unknown }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => typeof t?.name === "string")
      .map((t) => ({
        name: String(t.name),
        price: Number.isFinite(Number(t.price)) ? String(t.price) : "0",
        description: typeof t.description === "string" ? t.description : "",
        serviceFee: Number.isFinite(Number(t.serviceFee)) && Number(t.serviceFee) > 0 ? String(t.serviceFee) : "",
      }));
  } catch {
    return [];
  }
}

function parseGallery(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/** DB-Event → wizard-form-state, voor de bewerken-flow. Promotie-velden blijven
 *  op de initial-waarden (promotie is niet bewerkbaar via de edit-flow). */
export function eventToFormState(event: Event): EventFormState {
  const tz = event.timezone;

  return {
    ...INITIAL_EVENT_FORM,
    eventType: (event.eventType as EventType) ?? "",
    title: event.title,
    description: event.description ?? "",

    // Eendaags per definitie — een legacy meerdaags event wordt bij bewerken
    // teruggebracht naar de startdag (eindtijd blijft de tijd-van-de-dag).
    startDate: toLocalDate(event.startTime, tz),
    startTime: toLocalTime(event.startTime, tz),
    endTime: toLocalTime(event.endTime, tz),

    tournamentFormat: event.tournamentFormat ?? "",
    isSanctioned: event.isSanctioned,
    prizePool: event.prizePool ?? "",

    venueName: event.venueName,
    street: event.street,
    houseNumber: event.houseNumber,
    postalCode: event.postalCode,
    city: event.city,
    country: event.country,

    organizerName: event.organizerName ?? "",
    organizerWebsite: event.organizerWebsite ?? "",

    entryType: event.entryType === "FREE" ? "FREE" : "PAID",
    ticketTypes: parseNamePriceList(event.ticketTypes),
    ticketSaleMode: event.registrationUrl ? "ONLINE" : "DOOR",
    registrationUrl: event.registrationUrl ?? "",
    earlyAccessTime: event.earlyAccessTime ? toLocalTime(event.earlyAccessTime, tz) : "",

    vendorOptions: parseNamePriceList(event.vendorOptions),
    vendorInfo: event.vendorInfo ?? "",

    canPlay: event.canPlay,
    canTrade: event.canTrade,
    canSell: event.canSell,
    hasParking: event.hasParking,
    hasFood: event.hasFood,
    hasToilets: event.hasToilets,
    hasWifi: event.hasWifi,
    cardPayment: event.cardPayment,
    wheelchairAccessible: event.wheelchairAccessible,
    hasCloakroom: event.hasCloakroom,
    childFriendly: event.childFriendly,

    maxVisitors: event.maxVisitors ? String(event.maxVisitors) : "",
    venueSizeM2: event.venueSizeM2 ? String(event.venueSizeM2) : "",
    totalTables: event.totalTables ? String(event.totalTables) : "",

    coverImage: event.coverImage ?? "",
    flyerImage: event.flyerImage ?? "",
    galleryImages: parseGallery(event.galleryImages),
    videoUrl: event.videoUrl ?? "",
  };
}
