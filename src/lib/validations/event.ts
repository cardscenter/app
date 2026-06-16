import { z } from "zod";
import { EVENT_TYPES, ENTRY_CURRENCIES } from "@/lib/events/types";
import { EVENT_COUNTRY_CODES } from "@/lib/events/countries";

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

    startDate: dateField,
    startTime: timeField,
    endDate: dateField.optional(),
    endTime: timeField,

    // Entree — gratis of betaald met zelf-gedefinieerde ticket-soorten.
    entryType: z.enum(["FREE", "PAID"]).default("FREE"),
    entryCurrency: z.string().optional(),
    ticketTypes: z.string().optional(), // JSON [{name, price}]
    childrenFreeUntilAge: z.coerce.number().int().min(1).max(21).optional(),

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

    maxVisitors: z.coerce.number().int().min(1).max(1000000).optional(),
    registrationUrl: z.string().url("Ongeldige link").max(500).optional().or(z.literal("")),

    coverImage: z.string().optional(),

    tournamentFormat: z.string().max(100).optional(),
    isSanctioned: boolField,
    prizePool: z.string().max(300).optional(),

    promote: boolField,
    promoteDays: z.coerce.number().int().min(1).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    const endDate = data.endDate || data.startDate;
    if (`${endDate}T${data.endTime}` <= `${data.startDate}T${data.startTime}`) {
      ctx.addIssue({ code: "custom", message: "De eindtijd moet na de begintijd liggen", path: ["endTime"] });
    }

    if (data.entryType === "PAID") {
      if (!data.entryCurrency || !ENTRY_CURRENCIES.includes(data.entryCurrency as never)) {
        ctx.addIssue({ code: "custom", message: "Kies een valuta", path: ["entryCurrency"] });
      }
      if (!hasValidNamePriceList(data.ticketTypes)) {
        ctx.addIssue({ code: "custom", message: "Voeg minstens één ticket-soort met naam en prijs toe", path: ["ticketTypes"] });
      }
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(8000).optional(),
  venueName: z.string().min(2).max(150).optional(),
  street: z.string().min(1).max(150).optional(),
  houseNumber: z.string().min(1).max(20).optional(),
  postalCode: z.string().min(2).max(20).optional(),
  city: z.string().min(1).max(100).optional(),
  country: z.string().refine((c) => EVENT_COUNTRY_CODES.includes(c)).optional(),
  startDate: dateField.optional(),
  startTime: timeField.optional(),
  endDate: dateField.optional(),
  endTime: timeField.optional(),
  registrationUrl: z.string().url().max(500).optional().or(z.literal("")),
  coverImage: z.string().optional(),
});

export const reportEventSchema = z.object({
  reason: z.enum(["MISLEADING", "OFFENSIVE", "SPAM", "INAPPROPRIATE", "OTHER"]),
  details: z.string().min(10, "Geef wat meer details (min. 10 tekens)").max(1000),
});
