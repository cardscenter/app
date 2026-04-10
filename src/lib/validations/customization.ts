import { z } from "zod";

export const purchaseEmberSchema = z.object({
  amount: z.number().int().positive().min(100).max(5000),
});

export const openLootboxSchema = z.object({
  lootboxId: z.string().min(1),
});

export const recycleDuplicateSchema = z.object({
  openingId: z.string().min(1),
  choice: z.enum(["XP", "EMBER"]),
});

export const equipItemSchema = z.object({
  itemKey: z.string().min(1),
  slot: z.enum(["banner", "emblem", "background"]),
});

export const unequipSlotSchema = z.object({
  slot: z.enum(["banner", "emblem", "background"]),
});
