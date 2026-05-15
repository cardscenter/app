import { z } from "zod";
import { LISTING_TYPES, DELIVERY_METHODS, PACKAGE_SIZES, SEALED_PRODUCT_TYPES, UPSELL_TYPES } from "@/types";

const upsellEntrySchema = z.object({
  type: z.enum(UPSELL_TYPES),
  days: z.coerce.number().int().min(1).max(30),
});

export const createListingSchema = z.object({
  // Type
  listingType: z.enum(LISTING_TYPES),

  // Images
  imageUrls: z.string().optional(), // JSON array

  // Details (common)
  title: z.string().min(3, "Titel moet minimaal 3 tekens zijn").max(100),
  description: z.string().min(10, "Beschrijving moet minimaal 10 tekens zijn").max(2000),

  // Details (type-specific, all optional at schema level — validated via superRefine)
  cardName: z.string().optional(),
  cardSetId: z.string().optional(),
  tcgdexId: z.string().optional(),
  productType: z.enum(SEALED_PRODUCT_TYPES).optional(),
  itemCategory: z.string().optional(),

  // Condition (part of details for SINGLE_CARD)
  condition: z.string().optional(),

  // Pricing
  pricingType: z.enum(["FIXED", "NEGOTIABLE"]),
  price: z.coerce.number().min(0.01).optional(),

  // Shipping
  deliveryMethod: z.enum(DELIVERY_METHODS),
  freeShipping: z.coerce.boolean().default(false),
  shippingCost: z.coerce.number().min(0).default(0),
  carriers: z.string().optional(), // JSON array
  packageSize: z.enum(PACKAGE_SIZES).optional(),
  packageCount: z.coerce.number().int().min(1).max(10).default(1),

  // Brievenbuspakket opt-in (Fase 33 v2). Server leidt shippingMethodIds af
  // uit dit veld + seller's actieve slots: STANDARD+SIGNED altijd, MAILBOX
  // alleen als allowMailbox=true + type-eligible + price < €150.
  allowMailbox: z.coerce.boolean().default(false),

  // Upsells
  upsells: z.string().optional(), // JSON array of {type, days}

  // Voorraad (Fase 27.23) — alleen relevant voor SEALED_PRODUCT en OTHER.
  // Validatie checkt min 1, max 999 (sanity).
  stockQuantity: z.coerce.number().int().min(1).max(999).default(1),

  // Koop-toggles + vraagprijs (Fase 27.31)
  suggestedPrice: z.coerce.number().min(0.01).optional(),
  allowDirectBuy: z.coerce.boolean().default(true),
  acceptsOffers: z.coerce.boolean().default(true),

  // Pickup-betaal-modi (Fase 27.39): seller bepaalt of koper via wallet
  // (PLATFORM, escrow) en/of bij ophalen (EXTERNAL, Tikkie/contant) mag
  // betalen. Default beide aan. Validatie: voor PICKUP/BOTH listings moet
  // minstens één true zijn.
  allowPlatformPickup: z.coerce.boolean().default(true),
  allowExternalPickup: z.coerce.boolean().default(true),
}).superRefine((data, ctx) => {
  // Pickup-locatie wordt server-side uit User.city gevuld — geen form-input meer.

  // Pickup-modi (Fase 27.39): voor PICKUP/BOTH listings moet minstens één
  // betaal-modus toegestaan zijn anders kan niemand kopen.
  if (data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH") {
    if (!data.allowPlatformPickup && !data.allowExternalPickup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sta minstens één pickup-betaalwijze toe (vooraf via wallet of bij ophalen)",
        path: ["allowPlatformPickup"],
      });
    }
  }

  // Verzendmethoden worden server-side afgeleid (deriveListingShippingMethodIds).
  // Geen schema-validatie nodig; de action checkt zelf of de seller actieve
  // slots heeft voor SHIP/BOTH-listings.

  // Koop-opties (Fase 27.76): voor FIXED listings moet minstens één van
  // Direct Kopen of Biedingen aan staan. Anders kan niemand iets — dood
  // product op de marktplaats. Voor NEGOTIABLE zijn deze toggles irrelevant
  // (geen vaste prijs = altijd onderhandelen).
  if (data.pricingType === "FIXED" && !data.allowDirectBuy && !data.acceptsOffers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Bij vaste prijs: sta minstens Direct Kopen of biedingen toe",
      path: ["allowDirectBuy"],
    });
  }

  // Price required for FIXED pricing
  if (data.pricingType === "FIXED" && (!data.price || data.price <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Prijs is verplicht bij vaste prijs",
      path: ["price"],
    });
  }

  // SINGLE_CARD requires card details
  if (data.listingType === "SINGLE_CARD") {
    if (!data.cardName || data.cardName.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kaartnaam is verplicht", path: ["cardName"] });
    }
    if (!data.condition || data.condition.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecteer een conditie", path: ["condition"] });
    }
  }

  // MULTI_CARD + COLLECTION hebben geen extra verplichte velden meer
  // (Fase 33 v2): kaartlijst / collectie-info hoort in de beschrijving.

  // SEALED_PRODUCT requires productType
  if (data.listingType === "SEALED_PRODUCT") {
    if (!data.productType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecteer een producttype", path: ["productType"] });
    }
  }

  // OTHER has no extra required fields

  // Legacy shippingCost validation removed — shipping methods handle pricing now
  // Legacy carriers validation removed — ShippingMethodSelector handles this now

  // At least 1 image required
  if (!data.imageUrls) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal 1 foto toe", path: ["imageUrls"] });
  } else {
    try {
      const images = JSON.parse(data.imageUrls);
      if (!Array.isArray(images) || images.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal 1 foto toe", path: ["imageUrls"] });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige afbeeldingsgegevens", path: ["imageUrls"] });
    }
  }

  // Validate upsells JSON if provided
  if (data.upsells) {
    try {
      const parsed = JSON.parse(data.upsells);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const result = upsellEntrySchema.safeParse(entry);
          if (!result.success) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige upsell-gegevens", path: ["upsells"] });
            break;
          }
        }
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige upsell-gegevens", path: ["upsells"] });
    }
  }
});

