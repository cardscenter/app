import { z } from "zod";
import { COUNTRY_CODES } from "@/lib/shipping/countries";

export const addressSchema = z.object({
  street: z.string().min(1, "Straatnaam is verplicht").max(200),
  houseNumber: z.string().min(1, "Huisnummer is verplicht").max(20),
  postalCode: z.string().min(1, "Postcode is verplicht").max(20),
  city: z.string().min(1, "Woonplaats is verplicht").max(100),
  country: z.string().refine((val) => COUNTRY_CODES.includes(val), {
    message: "Selecteer een geldig land",
  }),
});

export type AddressInput = z.infer<typeof addressSchema>;
