import { z } from "zod";
import { EVENT_TYPES, ENTRY_CURRENCIES, ENTRY_PRICE_MODES } from "@/lib/events/types";
import { EVENT_COUNTRY_CODES } from "@/lib/events/countries";

// FormData levert checkboxes als "1"/"0" (door de wizard gezet).
const boolField = z
  .union([z.literal("0"), z.literal("1"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === "1" || v === "true");

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd");

export const createEventSchema = z
  .object({
    title: z.string().min(3, "Titel is te kort").max(120),
    description: z.string().max(8000).optional(), // HTML uit de rich-text-editor

    eventType: z.enum(EVENT_TYPES),

    // Locatie
    venueName: z.string().min(2, "Locatienaam is verplicht").max(150),
    street: z.string().min(1, "Straat is verplicht").max(150),
    houseNumber: z.string().min(1, "Huisnummer is verplicht").max(20),
    postalCode: z.string().min(2, "Postcode is verplicht").max(20),
    city: z.string().min(1, "Plaats is verplicht").max(100),
    country: z.string().refine((c) => EVENT_COUNTRY_CODES.includes(c), "Onbekend land"),

    // Tijd — wandklok in de event-tijdzone. endDate optioneel (default = startDate).
    startDate: dateField,
    startTime: timeField,
    endDate: dateField.optional(),
    endTime: timeField,

    // Entree
    entryType: z.enum(["FREE", "PAID"]).default("FREE"),
    entryPriceMode: z.enum(ENTRY_PRICE_MODES).default("SINGLE"),
    entryPrice: z.coerce.number().min(0).max(10000).optional(),
    entryCurrency: z.string().optional(),
    ticketTypes: z.string().optional(), // JSON [{name, price}]
    childrenFreeUntilAge: z.coerce.number().int().min(1).max(21).optional(),

    // Standhouders
    vendorTablePrice: z.coerce.number().min(0).max(10000).optional(),
    vendorChairPrice: z.coerce.number().min(0).max(10000).optional(),
    vendorPowerAvailable: boolField,
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
    registrationRequired: boolField,
    registrationUrl: z.string().url("Ongeldige link").max(500).optional().or(z.literal("")),

    coverImage: z.string().optional(),

    // Toernooi-specifiek
    tournamentFormat: z.string().max(100).optional(),
    isSanctioned: boolField,
    prizePool: z.string().max(300).optional(),

    // Promotie (betaalde uitgelichte banner)
    promote: boolField,
    promoteDays: z.coerce.number().int().min(1).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    const endDate = data.endDate || data.startDate;
    if (`${endDate}T${data.endTime}` <= `${data.startDate}T${data.startTime}`) {
      ctx.addIssue({ code: "custom", message: "De eindtijd moet na de begintijd liggen", path: ["endTime"] });
    }

    if (data.entryType === "PAID") {
      const currencyOk = data.entryCurrency && ENTRY_CURRENCIES.includes(data.entryCurrency as never);
      if (!currencyOk) {
        ctx.addIssue({ code: "custom", message: "Kies een valuta", path: ["entryCurrency"] });
      }
      if (data.entryPriceMode === "TIERS") {
        // Minstens één geldige ticket-soort met naam + prijs.
        let tiers: unknown;
        try {
          tiers = data.ticketTypes ? JSON.parse(data.ticketTypes) : [];
        } catch {
          tiers = null;
        }
        const valid =
          Array.isArray(tiers) &&
          tiers.length > 0 &&
          tiers.every(
            (t) =>
              t && typeof (t as { name?: unknown }).name === "string" &&
              (t as { name: string }).name.trim().length > 0 &&
              Number.isFinite(Number((t as { price?: unknown }).price)) &&
              Number((t as { price: number }).price) >= 0,
          );
        if (!valid) {
          ctx.addIssue({ code: "custom", message: "Voeg minstens één ticket-soort met naam en prijs toe", path: ["ticketTypes"] });
        }
      } else if (!data.entryPrice || data.entryPrice <= 0) {
        ctx.addIssue({ code: "custom", message: "Vul een entreeprijs in", path: ["entryPrice"] });
      }
    }

    if (data.registrationRequired && !data.registrationUrl) {
      ctx.addIssue({ code: "custom", message: "Vul de aanmeld-/ticketlink in", path: ["registrationUrl"] });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

// Update: alle velden optioneel; alleen wat meegestuurd wordt muteert.
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
