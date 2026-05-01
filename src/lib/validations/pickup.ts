import { z } from "zod";
import { PICKUP_CODE_LENGTH } from "@/lib/pickup-config";

const TIME_HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const proposePickupSchema = z.object({
  shippingBundleId: z.string().min(1),
  proposedFor: z.coerce.date().refine((d) => d.getTime() >= Date.now() - 86_400_000, {
    message: "Datum moet vandaag of later zijn",
  }),
  windowStart: z.string().regex(TIME_HHMM, "Tijdformaat moet HH:MM zijn"),
  windowEnd: z.string().regex(TIME_HHMM, "Tijdformaat moet HH:MM zijn"),
}).superRefine((data, ctx) => {
  if (data.windowStart >= data.windowEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Eindtijd moet later zijn dan starttijd",
      path: ["windowEnd"],
    });
  }
});

export const confirmPickupSchema = z.object({
  shippingBundleId: z.string().min(1),
  code: z
    .string()
    .regex(new RegExp(`^\\d{${PICKUP_CODE_LENGTH}}$`), `Code moet ${PICKUP_CODE_LENGTH} cijfers zijn`),
});
