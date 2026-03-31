import { z } from "zod";
import { COUNTRY_CODES } from "@/lib/shipping/countries";

export const shippingMethodSchema = z.object({
  carrier: z.string().min(1, "Vervoerder is verplicht"),
  serviceName: z.string().min(1, "Dienstnaam is verplicht").max(100),
  price: z.coerce.number().min(0, "Prijs moet 0 of hoger zijn"),
  countries: z
    .array(z.string())
    .min(1, "Selecteer minimaal 1 land")
    .refine((arr) => arr.every((c) => COUNTRY_CODES.includes(c)), {
      message: "Ongeldig land geselecteerd",
    }),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;
