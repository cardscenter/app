import { z } from "zod";

export const equipItemSchema = z.object({
  itemKey: z.string().min(1),
  slot: z.enum(["banner", "emblem", "background"]),
});

export const unequipSlotSchema = z.object({
  slot: z.enum(["banner", "emblem", "background"]),
});
