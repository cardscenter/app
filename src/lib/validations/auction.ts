import { z } from "zod";

export const createAuctionSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  auctionType: z.enum(["SINGLE_CARD", "COLLECTION", "BULK"]),
  cardName: z.string().max(200).optional(),
  cardSetId: z.string().optional(),
  condition: z.string().optional(),
  startingBid: z.coerce.number().min(0.01),
  reservePrice: z.coerce.number().min(0).optional(),
  buyNowPrice: z.coerce.number().min(0).optional(),
  duration: z.coerce.number().refine((v) => [1, 3, 5, 7].includes(v)),
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
