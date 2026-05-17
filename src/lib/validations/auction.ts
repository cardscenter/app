import { z } from "zod";
import { MAX_SCHEDULE_DAYS_AHEAD } from "@/lib/auction/timing";

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
    duration: z.coerce.number().refine((v) => [3, 5, 7, 14].includes(v)),
    // Tijdvenster (nieuw): startDate (calendar-day in NL-tijd) + eindtijd op
    // de laatste dag (HH:MM). Server berekent definitieve start/end-time
    // via deriveAuctionWindow in src/lib/auction/timing.ts.
    startDate: z.coerce.date(),
    endTimeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ongeldige eindtijd (gebruik HH:MM)"),
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
    // startDate moet tussen vandaag (NL-midnight) en vandaag + N dagen liggen.
    // We vergelijken op kalenderdag-niveau in UTC — de form levert een ISO-
    // string die op midnight UTC ligt voor de gekozen NL-kalenderdag.
    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);
    const maxDate = new Date(todayMidnightUtc.getTime() + MAX_SCHEDULE_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    if (data.startDate.getTime() < todayMidnightUtc.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Startdatum mag niet in het verleden liggen",
      });
    } else if (data.startDate.getTime() > maxDate.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: `Startdatum mag maximaal ${MAX_SCHEDULE_DAYS_AHEAD} dagen vooruit liggen`,
      });
    }
  });

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
