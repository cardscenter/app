import { z } from "zod";
import { PICKUP_CODE_REGEX } from "@/lib/pickup-config";

const TIME_HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const proposePickupSchema = z.object({
  shippingBundleId: z.string().min(1),
  proposedFor: z.coerce.date().refine((d) => d.getTime() >= Date.now() - 86_400_000, {
    message: "Datum moet vandaag of later zijn",
  }),
  windowStart: z.string().regex(TIME_HHMM, "Tijdformaat moet HH:MM zijn"),
  windowEnd: z.string().regex(TIME_HHMM, "Tijdformaat moet HH:MM zijn"),
}).superRefine((data, ctx) => {
  // windowStart > windowEnd is fout (eind voor begin). windowStart === windowEnd
  // is OK — dat representeert een exact moment ("om 14:30") in plaats van een
  // tijdspan ("tussen 14:00 en 16:00"). De UI toont dan een enkel tijd-veld.
  if (data.windowStart > data.windowEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Eindtijd moet later zijn dan of gelijk aan starttijd",
      path: ["windowEnd"],
    });
  }
});

export const confirmPickupSchema = z.object({
  shippingBundleId: z.string().min(1),
  // Code-formaat: 4 cijfers gevolgd door 1 hoofdletter (zonder O/I). Input-veld
  // upper-cased voor parsing zodat een buyer "4837k" mag intoetsen.
  code: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(PICKUP_CODE_REGEX, "Code moet 4 cijfers + 1 hoofdletter zijn (bijv. 4837K)")),
});
