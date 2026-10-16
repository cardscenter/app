import { z } from "zod";
import { EVENT_TYPE_COLORS } from "@/lib/shop-events/config";
import { shopWallClockToUtc } from "@/lib/shop-events/format";

/** Zod-schema's voor de admin-formulieren van winkel-events (Fase 3). */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? v.trim() : String(v)))
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= min && n <= max), { message: `Getal tussen ${min} en ${max}` })
    .nullable()
    .optional();

const bool = z
  .union([z.string(), z.boolean()])
  .transform((v) => v === true || v === "true" || v === "on" || v === "1")
  .optional()
  .default(false);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Alleen kleine letters, cijfers en koppeltekens")
  .min(2)
  .max(40);

export const ageDivisionRuleSchema = z.object({
  key: slug,
  label: z.string().trim().min(1).max(40),
  minBirthYear: z.number().int().min(1900).max(2100).optional(),
  maxBirthYear: z.number().int().min(1900).max(2100).optional(),
});

export const eventTypeSchema = z.object({
  key: slug,
  name: z.string().trim().min(2).max(60),
  game: optionalText(40),
  description: optionalText(500),
  color: z.enum(EVENT_TYPE_COLORS).default("blue"),
  /** JSON-string uit de divisie-editor; leeg = geen divisies. */
  ageDivisions: z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (!s) return null;
      try {
        const parsed = z.array(ageDivisionRuleSchema).parse(JSON.parse(s));
        return parsed.length ? JSON.stringify(parsed) : null;
      } catch {
        ctx.addIssue({ code: "custom", message: "Divisies: ongeldige invoer" });
        return z.NEVER;
      }
    })
    .optional()
    .default(""),
  defaultPrice: z.coerce.number().min(0).max(500).default(0),
  defaultCapacity: optionalInt(1, 500),
  countsForLeague: bool,
  countsForStampCard: bool,
  enabled: bool,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;

const dateStr = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-DD");
const timeStr = z.string().trim().regex(/^\d{2}:\d{2}$/, "Tijd als UU:MM");
const optionalDateStr = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().default("");
const optionalTimeStr = z.string().trim().regex(/^(\d{2}:\d{2})?$/).optional().default("");

export const shopEventSchema = z
  .object({
    typeId: z.string().min(1, "Kies een event-type"),
    title: z.string().trim().min(3, "Titel is te kort").max(100),
    description: optionalText(4000),
    game: optionalText(40),
    date: dateStr,
    startTime: timeStr,
    endTime: timeStr,
    registrationOpensDate: optionalDateStr,
    registrationOpensTime: optionalTimeStr,
    registrationDeadlineDate: optionalDateStr,
    registrationDeadlineTime: optionalTimeStr,
    price: z.coerce.number().min(0).max(500),
    capacity: optionalInt(1, 500),
    minAge: optionalInt(0, 99),
    maxAge: optionalInt(0, 99),
    underTwelveWithAdult: bool,
    waitlistEnabled: bool,
    countsForLeague: bool,
    countsForStampCard: bool,
    showParticipants: bool,
    cancellationHours: z.coerce.number().int().min(0).max(24 * 30).default(24),
    refundPolicy: optionalText(1000),
    coverImage: optionalText(500),
  })
  .transform((v, ctx) => {
    const startsAt = shopWallClockToUtc(v.date, v.startTime);
    let endsAt = shopWallClockToUtc(v.date, v.endTime);
    if (!startsAt || !endsAt) {
      ctx.addIssue({ code: "custom", message: "Datum of tijd is ongeldig", path: ["date"] });
      return z.NEVER;
    }
    // Eindtijd vóór de starttijd = loopt door tot na middernacht.
    if (endsAt.getTime() <= startsAt.getTime()) endsAt = new Date(endsAt.getTime() + 24 * 3600_000);
    const opens =
      v.registrationOpensDate && v.registrationOpensTime
        ? shopWallClockToUtc(v.registrationOpensDate, v.registrationOpensTime)
        : v.registrationOpensDate
          ? shopWallClockToUtc(v.registrationOpensDate, "00:00")
          : null;
    const deadline =
      v.registrationDeadlineDate && v.registrationDeadlineTime
        ? shopWallClockToUtc(v.registrationDeadlineDate, v.registrationDeadlineTime)
        : v.registrationDeadlineDate
          ? shopWallClockToUtc(v.registrationDeadlineDate, "23:59")
          : null;
    if (deadline && deadline.getTime() > startsAt.getTime()) {
      ctx.addIssue({ code: "custom", message: "De inschrijfdeadline moet vóór de start liggen", path: ["registrationDeadlineDate"] });
      return z.NEVER;
    }
    if (opens && deadline && opens.getTime() >= deadline.getTime()) {
      ctx.addIssue({ code: "custom", message: "Inschrijving opent na de deadline", path: ["registrationOpensDate"] });
      return z.NEVER;
    }
    if (v.minAge !== null && v.minAge !== undefined && v.maxAge !== null && v.maxAge !== undefined && v.minAge > v.maxAge) {
      ctx.addIssue({ code: "custom", message: "Minimumleeftijd is hoger dan de maximumleeftijd", path: ["minAge"] });
      return z.NEVER;
    }
    if (v.coverImage && !v.coverImage.startsWith("/api/uploads/") && !/^https?:\/\//.test(v.coverImage)) {
      ctx.addIssue({ code: "custom", message: "Ongeldige afbeelding", path: ["coverImage"] });
      return z.NEVER;
    }
    return {
      typeId: v.typeId,
      title: v.title,
      description: v.description ?? null,
      game: v.game ?? null,
      startsAt,
      endsAt,
      registrationOpensAt: opens,
      registrationDeadline: deadline,
      price: Math.round(v.price * 100) / 100,
      capacity: v.capacity ?? null,
      minAge: v.minAge ?? null,
      maxAge: v.maxAge ?? null,
      underTwelveWithAdult: v.underTwelveWithAdult,
      waitlistEnabled: v.waitlistEnabled,
      countsForLeague: v.countsForLeague,
      countsForStampCard: v.countsForStampCard,
      showParticipants: v.showParticipants,
      cancellationHours: v.cancellationHours,
      refundPolicy: v.refundPolicy ?? null,
      coverImage: v.coverImage ?? null,
    };
  });

export type ShopEventInput = z.infer<typeof shopEventSchema>;

export const hubSettingsSchema = z.object({
  maxOccupancy: z.coerce.number().int().min(0).max(2000),
  openingHours: z.string().trim().max(2000),
  cancellationPolicy: z.string().trim().max(2000),
  eventInfo: z.string().trim().max(2000),
  houseRules: z.string().trim().max(5000),
  directions: z.string().trim().max(5000),
  stampsPerCard: z.coerce.number().int().min(1).max(100),
  pointsPerCheckIn: z.coerce.number().int().min(0).max(1000),
  pointsPerFullCard: z.coerce.number().int().min(0).max(1000),
  stampReward: z.string().trim().min(1).max(500),
});

/** FormData → plain object (checkboxes die ontbreken worden "false"). */
export function formDataToObject(fd: FormData, booleanKeys: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  for (const k of booleanKeys) if (!(k in out)) out[k] = "false";
  return out;
}

export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue ? `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}` : "Ongeldige invoer";
}
