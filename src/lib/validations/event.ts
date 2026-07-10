import { z } from "zod";
import { EVENT_TYPES } from "@/lib/events/types";
import { EVENT_COUNTRY_CODES } from "@/lib/events/countries";
import { isSupportedVideoUrl } from "@/lib/events/video";

const boolField = z
  .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === "1" || v === "true");

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd");

// Valideert een JSON-string van [{name, price}] met minstens één geldige rij.
function hasValidNamePriceList(raw: string | undefined): boolean {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    return false;
  }
  return (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.every(
      (t) =>
        t &&
        typeof (t as { name?: unknown }).name === "string" &&
        (t as { name: string }).name.trim().length > 0 &&
        Number.isFinite(Number((t as { price?: unknown }).price)) &&
        Number((t as { price: number }).price) >= 0,
    )
  );
}

export const createEventSchema = z
  .object({
    title: z.string().min(3, "Titel is te kort").max(120),
    description: z.string().max(8000).optional(),
    eventType: z.enum(EVENT_TYPES),

    venueName: z.string().min(2, "Locatienaam is verplicht").max(150),
    street: z.string().min(1, "Straat is verplicht").max(150),
    houseNumber: z.string().min(1, "Huisnummer is verplicht").max(20),
    postalCode: z.string().min(2, "Postcode is verplicht").max(20),
    city: z.string().min(1, "Plaats is verplicht").max(100),
    country: z.string().refine((c) => EVENT_COUNTRY_CODES.includes(c), "Onbekend land"),

    organizerName: z.string().max(100).optional(),
    organizerWebsite: z.string().url("Ongeldige website-link").max(500).optional().or(z.literal("")),
    socialLinks: z.string().optional(), // JSON [url] — max 4, gevalideerd via parseSocialLinks

    // Eendaags per definitie — meerdaagse beurzen = één event per dag.
    startDate: dateField,
    startTime: timeField,
    endTime: timeField,

    // Entree — gratis of betaald met zelf-gedefinieerde ticket-soorten (altijd EUR).
    entryType: z.enum(["FREE", "PAID"]).default("PAID"),
    ticketTypes: z.string().optional(), // JSON [{name, price}]
    // Niet opgeslagen in DB (registrationUrl-aanwezigheid codeert het al), maar
    // nodig om server-side af te dwingen dat ONLINE-verkoop een link heeft.
    ticketSaleMode: z.enum(["ONLINE", "DOOR"]).optional(),
    earlyAccessTime: timeField.optional(), // vroege toegang (VT), vóór startTime

    // Standhouders — zelf-gedefinieerde opties.
    vendorOptions: z.string().optional(), // JSON [{name, price}]
    vendorInfo: z.string().max(1000).optional(),

    // Activiteiten + faciliteiten
    canPlay: boolField,
    canTrade: boolField,
    canSell: boolField,
    hasParking: boolField,
    hasFood: boolField,
    hasToilets: boolField,
    hasWifi: boolField,
    cardPayment: boolField,
    wheelchairAccessible: boolField,
    hasCloakroom: boolField,
    childFriendly: boolField,

    maxVisitors: z.coerce.number().int().min(1).max(1000000).optional(),
    venueSizeM2: z.coerce.number().int().min(1).max(1000000).optional(),
    totalTables: z.coerce.number().int().min(1).max(100000).optional(),
    registrationUrl: z.string().url("Ongeldige link").max(500).optional().or(z.literal("")),

    coverImage: z.string().optional(),
    flyerImage: z.string().optional(), // staande flyer/poster
    galleryImages: z.string().optional(), // JSON [url]
    videoUrl: z.string().max(500).optional().or(z.literal("")),

    tournamentFormat: z.string().max(100).optional(),
    isSanctioned: boolField,
    prizePool: z.string().max(300).optional(),

    promote: boolField,
    promoteDays: z.coerce.number().int().min(1).max(90).optional(),
    spotlight: boolField,
    spotlightDays: z.coerce.number().int().min(1).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({ code: "custom", message: "De eindtijd moet na de begintijd liggen", path: ["endTime"] });
    }

    if (data.entryType === "PAID") {
      if (!hasValidNamePriceList(data.ticketTypes)) {
        ctx.addIssue({ code: "custom", message: "Voeg minstens één ticket-soort met naam en prijs toe", path: ["ticketTypes"] });
      }
      // Bij online verkoop is de ticketlink verplicht; "alleen aan de deur"
      // (DOOR of geen mode meegestuurd) mag zonder link.
      if (data.ticketSaleMode === "ONLINE" && !data.registrationUrl) {
        ctx.addIssue({ code: "custom", message: "Vul de ticketlink in of kies 'Alleen aan de deur'", path: ["registrationUrl"] });
      }
    }

    // VT hoort bij de openingstijden, los van gratis/betaald.
    if (data.earlyAccessTime && data.earlyAccessTime >= data.startTime) {
      ctx.addIssue({ code: "custom", message: "Vroege toegang moet vóór de reguliere begintijd liggen", path: ["earlyAccessTime"] });
    }

    if (data.videoUrl && !isSupportedVideoUrl(data.videoUrl)) {
      ctx.addIssue({ code: "custom", message: "Gebruik een geldige YouTube- of Vimeo-link", path: ["videoUrl"] });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

// Edit-flow: alle velden optioneel (alleen meegestuurde velden worden bijgewerkt).
// Lege string = expliciet leegmaken voor nullable velden. eventType is bewust
// NIET bewerkbaar (bepaalt kalender-tab + toernooivelden).
export const updateEventSchema = z
  .object({
    title: z.string().min(3, "Titel is te kort").max(120).optional(),
    description: z.string().max(8000).optional(),
    venueName: z.string().min(2, "Locatienaam is verplicht").max(150).optional(),
    street: z.string().min(1).max(150).optional(),
    houseNumber: z.string().min(1).max(20).optional(),
    postalCode: z.string().min(2).max(20).optional(),
    city: z.string().min(1).max(100).optional(),
    country: z.string().refine((c) => EVENT_COUNTRY_CODES.includes(c), "Onbekend land").optional(),
    organizerName: z.string().max(100).optional(),
    organizerWebsite: z.string().url("Ongeldige website-link").max(500).optional().or(z.literal("")),
    socialLinks: z.string().optional(), // JSON [url]
    startDate: dateField.optional(),
    startTime: timeField.optional(),
    endTime: timeField.optional(),
    entryType: z.enum(["FREE", "PAID"]).optional(),
    ticketTypes: z.string().optional(),
    ticketSaleMode: z.enum(["ONLINE", "DOOR"]).optional(),
    earlyAccessTime: timeField.optional().or(z.literal("")),
    registrationUrl: z.string().url("Ongeldige link").max(500).optional().or(z.literal("")),
    vendorOptions: z.string().optional(),
    vendorInfo: z.string().max(1000).optional(),
    canPlay: boolField,
    canTrade: boolField,
    canSell: boolField,
    hasParking: boolField,
    hasFood: boolField,
    hasToilets: boolField,
    hasWifi: boolField,
    cardPayment: boolField,
    wheelchairAccessible: boolField,
    hasCloakroom: boolField,
    childFriendly: boolField,
    maxVisitors: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000000)]).optional(),
    venueSizeM2: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000000)]).optional(),
    totalTables: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]).optional(),
    coverImage: z.string().optional(),
    flyerImage: z.string().optional(),
    galleryImages: z.string().optional(),
    videoUrl: z.string().max(500).optional().or(z.literal("")),
    tournamentFormat: z.string().max(100).optional(),
    isSanctioned: boolField,
    prizePool: z.string().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      ctx.addIssue({ code: "custom", message: "De eindtijd moet na de begintijd liggen", path: ["endTime"] });
    }
    if (data.entryType === "PAID") {
      if (!hasValidNamePriceList(data.ticketTypes)) {
        ctx.addIssue({ code: "custom", message: "Voeg minstens één ticket-soort met naam en prijs toe", path: ["ticketTypes"] });
      }
      if (data.ticketSaleMode === "ONLINE" && !data.registrationUrl) {
        ctx.addIssue({ code: "custom", message: "Vul de ticketlink in of kies 'Alleen aan de deur'", path: ["registrationUrl"] });
      }
    }
    if (data.earlyAccessTime && data.startTime && data.earlyAccessTime >= data.startTime) {
      ctx.addIssue({ code: "custom", message: "Vroege toegang moet vóór de reguliere begintijd liggen", path: ["earlyAccessTime"] });
    }
    if (data.videoUrl && !isSupportedVideoUrl(data.videoUrl)) {
      ctx.addIssue({ code: "custom", message: "Gebruik een geldige YouTube- of Vimeo-link", path: ["videoUrl"] });
    }
  });

export const reportEventSchema = z.object({
  reason: z.enum(["MISLEADING", "OFFENSIVE", "SPAM", "INAPPROPRIATE", "OTHER"]),
  details: z.string().min(10, "Geef wat meer details (min. 10 tekens)").max(1000),
});
