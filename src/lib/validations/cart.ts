import { z } from "zod";

export const addToCartSchema = z.object({
  claimsaleItemId: z.string().min(1),
});

export const removeFromCartSchema = z.object({
  cartItemId: z.string().min(1),
});
