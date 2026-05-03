import { z } from "zod";
import { MIN_LISTINGS_PER_BUNDLE, MAX_LISTINGS_PER_BUNDLE } from "@/lib/bundle-offer-config";

// Per-listing entry: voor stocked SEALED/OTHER een quantity; voor MULTI_CARD
// met partial-sale een lijst itemIds. Default quantity=1, geen itemIds — voor
// non-stocked single-flip listings (de hele listing wordt afgenomen).
export const bundleOfferListingEntrySchema = z.object({
  listingId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  itemIds: z.array(z.string().min(1)).optional(),
});

export const createBundleOfferSchema = z.object({
  conversationId: z.string().min(1),
  listings: z
    .array(bundleOfferListingEntrySchema)
    .min(MIN_LISTINGS_PER_BUNDLE, `Selecteer minimaal ${MIN_LISTINGS_PER_BUNDLE} advertenties`)
    .max(MAX_LISTINGS_PER_BUNDLE, `Maximaal ${MAX_LISTINGS_PER_BUNDLE} advertenties per bundel`),
  totalAmount: z.coerce.number().min(0.01, "Voer een totaalbedrag in"),
  // Fase 27.43: deliveryChoice combineert bezorg-route + betaal-modus tot één
  // keuze (3 opties). Backend leidt deliveryMethod + paymentMode hieruit af.
  // - SHIP = verzenden via PLATFORM-escrow (default)
  // - PICKUP_PLATFORM = ophalen, vooraf via wallet (escrow + code-confirm)
  // - PICKUP_EXTERNAL = ophalen, betalen aan seller bij ophalen (Tikkie/contant)
  deliveryChoice: z.enum(["SHIP", "PICKUP_PLATFORM", "PICKUP_EXTERNAL"]).default("SHIP"),
  // Buyer geeft alleen voorkeur aan; seller kiest bij accept de daadwerkelijke
  // SellerShippingMethod (server forceert isSigned=true wanneer deze flag aan is
  // óf wanneer requiresSignedShipping naar true evalueert via de bestaande regels).
  requestInsuredShipping: z.coerce.boolean().default(false),
});

export const acceptBundleOfferShippingSchema = z.object({
  bundleProposalId: z.string().min(1),
  // SellerShippingMethod-id van de seller. Bij PICKUP-bundles mag deze leeg.
  shippingMethodId: z.string().optional(),
});

export const counterBundleOfferSchema = z.object({
  parentProposalId: z.string().min(1),
  totalAmount: z.coerce.number().min(0.01),
});
