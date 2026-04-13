import { z } from "zod";

export const createAuctionSchema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.string().max(2000).optional(),
    auctionType: z.enum(["SINGLE_CARD", "MULTI_CARD", "COLLECTION", "SEALED_PRODUCT", "OTHER"]),
    cardName: z.string().max(200).optional(),
    cardSetId: z.string().optional(),
    condition: z.string().optional(),
    tcgdexId: z.string().optional(),
    // Multi-card
    cardItems: z.string().optional(), // JSON array
    // Collection
    estimatedCardCount: z.coerce.number().int().min(1).optional(),
    conditionRange: z.string().optional(),
    // Sealed product
    productType: z.string().optional(),
    // Other/Collectibles
    itemCategory: z.string().optional(),
    // Pricing
    startingBid: z.coerce.number().min(0.01),
    reservePrice: z.coerce.number().min(0).optional(),
    buyNowPrice: z.coerce.number().min(0).optional(),
    duration: z.coerce.number().refine((v) => [3, 5, 7, 14].includes(v)),
    // Upsells
    upsells: z.string().optional(), // JSON array: [{type, days}]
  })
  .superRefine((data, ctx) => {
    if (data.buyNowPrice !== undefined && data.buyNowPrice > 0 && data.buyNowPrice <= data.startingBid) {
      ctx.addIssue({
        code: "custom",
        path: ["buyNowPrice"],
        message: "Buy Now-prijs moet hoger zijn dan het startbod",
      });
    }
    if (data.reservePrice !== undefined && data.reservePrice > 0 && data.reservePrice < data.startingBid) {
      ctx.addIssue({
        code: "custom",
        path: ["reservePrice"],
        message: "Reserveprijs mag niet lager zijn dan het startbod",
      });
    }
  });

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
