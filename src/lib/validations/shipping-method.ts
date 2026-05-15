import { z } from "zod";

/** Update-payload voor één static shipping-slot (Fase 33). */
export const updateShippingSlotSchema = z.object({
  id: z.string().min(1),
  carrier: z.string().min(1).optional(),
  priceOverride: z.coerce.number().positive().nullable().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type UpdateShippingSlotInput = z.infer<typeof updateShippingSlotSchema>;

/** Selling-scope toggle. */
export const sellingScopeSchema = z.object({
  scope: z.enum(["DOMESTIC_ONLY", "DOMESTIC_AND_NEAR", "ALL_EU"] as const),
});

export type SellingScopeInput = z.infer<typeof sellingScopeSchema>;
