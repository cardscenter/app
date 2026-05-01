import { z } from "zod";
import { MIN_LISTINGS_PER_BUNDLE, MAX_LISTINGS_PER_BUNDLE } from "@/lib/bundle-offer-config";

export const createBundleOfferSchema = z.object({
  conversationId: z.string().min(1),
  listingIds: z
    .array(z.string().min(1))
    .min(MIN_LISTINGS_PER_BUNDLE, `Selecteer minimaal ${MIN_LISTINGS_PER_BUNDLE} advertenties`)
    .max(MAX_LISTINGS_PER_BUNDLE, `Maximaal ${MAX_LISTINGS_PER_BUNDLE} advertenties per bundel`),
  totalAmount: z.coerce.number().min(0.01, "Voer een totaalbedrag in"),
  deliveryMethod: z.enum(["SHIP", "PICKUP"]),
  shippingMethodId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.deliveryMethod === "SHIP" && !data.shippingMethodId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Kies een verzendmethode",
      path: ["shippingMethodId"],
    });
  }
});

export const counterBundleOfferSchema = z.object({
  parentProposalId: z.string().min(1),
  totalAmount: z.coerce.number().min(0.01),
});
