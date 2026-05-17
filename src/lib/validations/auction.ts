import { z } from "zod";
import {
  MAX_SCHEDULE_DAYS_AHEAD,
  MAX_AUCTION_DURATION_MS,
  MIN_AUCTION_DURATION_MS,
} from "@/lib/auction/timing";

/**
 * Minimum startbod voor een veiling. Items onder dit bedrag horen via een
 * claimsale verkocht te worden — het veiling-format met biedstappen, anti-snipe
 * en 2,9% premium loont niet bij lage waardes en zou de marktplaats vullen
 * met lage-waarde-spam.
 */
export const MIN_STARTING_BID = 5;

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
    // Sealed product
    productType: z.string().optional(),
    // Other/Collectibles
    itemCategory: z.string().optional(),
    // Pricing — minimumstartbod is €5; lagere items horen in een claimsale.
    startingBid: z.coerce.number().min(MIN_STARTING_BID, `Het startbod moet minimaal €${MIN_STARTING_BID} zijn`),
    reservePrice: z.coerce.number().min(0).optional(),
    buyNowPrice: z.coerce.number().min(0).optional(),
    // Tijdvenster: directe start- en eindtijd. startTime mag tot
    // MAX_SCHEDULE_DAYS_AHEAD dagen vooruit; veiling-lengte (endTime −
    // startTime) tussen MIN/MAX_AUCTION_DURATION_MS.
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    // Runner-up rotation: "1" (default on) or "0" — opt-out from FormData
    runnerUpEnabled: z
      .union([z.literal("0"), z.literal("1")])
      .optional()
      .transform((v) => v === undefined ? true : v === "1"),
    // Delivery (Fase 27.95)
    deliveryMethod: z.enum(["SHIP", "PICKUP", "BOTH"]).default("SHIP"),
    // Brievenbuspakket opt-in (Fase 33 v2). Server leidt verzendmethoden af
    // op basis van seller's actieve slots + dit veld.
    allowMailbox: z.coerce.boolean().default(false),
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
    // BuyNow moet boven Reserve liggen — anders kan een koper Direct Kopen
    // onder de reserve, terwijl reserve juist bedoeld is als minimum.
    if (
      data.buyNowPrice !== undefined &&
      data.buyNowPrice > 0 &&
      data.reservePrice !== undefined &&
      data.reservePrice > 0 &&
      data.buyNowPrice <= data.reservePrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["buyNowPrice"],
        message: "Direct Kopen-prijs moet hoger zijn dan de reserveprijs",
      });
    }
    // Tijdvenster: start moet in [now − 1min, now + 7 dagen]; eind moet
    // ≥ start + 1u en ≤ start + 14 dagen.
    const now = Date.now();
    const slack = 60 * 1000; // 1 min slack voor klokken-skew tussen browser en server
    const maxStartMs = now + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000;
    const startMs = data.startTime.getTime();
    const endMs = data.endTime.getTime();

    if (startMs < now - slack) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Starttijd mag niet in het verleden liggen",
      });
    } else if (startMs > maxStartMs) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: `Starttijd mag maximaal ${MAX_SCHEDULE_DAYS_AHEAD} dagen vooruit liggen`,
      });
    }
    const diffMs = endMs - startMs;
    if (diffMs < MIN_AUCTION_DURATION_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "De veiling moet minstens een uur duren",
      });
    } else if (diffMs >= MAX_AUCTION_DURATION_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Een veiling mag niet 15 dagen of langer duren",
      });
    }
  });

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

/**
 * Update-schema voor bestaande veilingen. Alle velden optional — server bepaalt
 * via `computeEditScope` welke velden in de huidige status mogen worden gewijzigd.
 *
 * Drie image-paden:
 *   imageUrls        — JSON array, FULL replace (alleen in FULL/TIMING_LOCKED scope)
 *   appendImageUrls  — JSON array, additive (in alle non-NONE scopes — voorkomt
 *                      bait-and-switch bij actieve biedingen)
 */
export const updateAuctionSchema = z
  .object({
    description: z.string().max(2000).optional(),
    appendImageUrls: z.string().optional(),
    imageUrls: z.string().optional(),
    addLabels: z.string().optional(),
    title: z.string().min(3).max(100).optional(),
    cardItems: z.string().optional(),
    estimatedCardCount: z.coerce.number().int().min(0).optional(),
    conditionRange: z.string().optional(),
    productType: z.string().optional(),
    itemCategory: z.string().optional(),
    startingBid: z.coerce.number().min(MIN_STARTING_BID).optional(),
    reservePrice: z.coerce.number().min(0).optional(),
    buyNowPrice: z.coerce.number().min(0).optional(),
    pickupCity: z.string().optional(),
    shippingMethodIds: z.string().optional(),
    // Edit: alleen endTime is in FULL-scope muteerbaar. startTime laten we
    // optioneel voor toekomstig gebruik maar de drawer stuurt hem niet.
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.buyNowPrice !== undefined &&
      data.buyNowPrice > 0 &&
      data.startingBid !== undefined &&
      data.buyNowPrice <= data.startingBid
    ) {
      ctx.addIssue({ code: "custom", path: ["buyNowPrice"], message: "Buy Now-prijs moet hoger zijn dan het startbod" });
    }
    if (
      data.reservePrice !== undefined &&
      data.reservePrice > 0 &&
      data.startingBid !== undefined &&
      data.reservePrice < data.startingBid
    ) {
      ctx.addIssue({ code: "custom", path: ["reservePrice"], message: "Reserveprijs mag niet lager zijn dan het startbod" });
    }
    if (
      data.buyNowPrice !== undefined &&
      data.buyNowPrice > 0 &&
      data.reservePrice !== undefined &&
      data.reservePrice > 0 &&
      data.buyNowPrice <= data.reservePrice
    ) {
      ctx.addIssue({ code: "custom", path: ["buyNowPrice"], message: "Direct Kopen-prijs moet hoger zijn dan de reserveprijs" });
    }
  });

export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;
