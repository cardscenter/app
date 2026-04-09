import { z } from "zod";
import { LISTING_TYPES, DELIVERY_METHODS, CARRIERS, PACKAGE_SIZES, SEALED_PRODUCT_TYPES, UPSELL_TYPES } from "@/types";

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
  cardItems: z.string().optional(), // JSON array for MULTI_CARD
  estimatedCardCount: z.coerce.number().int().min(1).optional(),
  conditionRange: z.string().optional(),
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

  // Shipping methods
  shippingMethodIds: z.string().optional(), // JSON array of shipping method IDs

  // Upsells
  upsells: z.string().optional(), // JSON array of {type, days}
}).superRefine((data, ctx) => {
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

  // MULTI_CARD requires cardItems
  if (data.listingType === "MULTI_CARD") {
    if (!data.cardItems) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal één kaart toe", path: ["cardItems"] });
    } else {
      try {
        const items = JSON.parse(data.cardItems);
        if (!Array.isArray(items) || items.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Voeg minimaal één kaart toe", path: ["cardItems"] });
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige kaartgegevens", path: ["cardItems"] });
      }
    }
  }

  // COLLECTION requires estimatedCardCount
  if (data.listingType === "COLLECTION") {
    if (!data.estimatedCardCount || data.estimatedCardCount < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Geschat aantal kaarten is verplicht", path: ["estimatedCardCount"] });
    }
  }

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
