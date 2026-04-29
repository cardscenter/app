import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";

interface BuyerAddress {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

interface CreatePendingBundleInput {
  buyerId: string;
  sellerId: string;
  totalItemCost: number;
  shippingCost: number;
  auctionId?: string | null;
  listingId?: string | null;
  address?: BuyerAddress;
}

// Pre-creates a ShippingBundle in PENDING state for purchases that haven't
// been fully paid yet (auction AWAITING_PAYMENT, proposal partial balance).
// At payment completion the caller should `update` this row to PAID instead
// of creating a fresh one — the unique constraints on auctionId/listingId
// would block that anyway.
//
// Address fields are optional: an auction winner may not have a saved
// address yet at the point we set AWAITING_PAYMENT, so we accept nulls and
// fill them in at completion time.
export async function createPendingBundle(input: CreatePendingBundleInput) {
  const totalCost = input.totalItemCost + input.shippingCost;

  return prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      shippingCost: input.shippingCost,
      totalItemCost: input.totalItemCost,
      totalCost,
      status: "PENDING",
      auctionId: input.auctionId ?? null,
      listingId: input.listingId ?? null,
      buyerStreet: input.address?.street ?? null,
      buyerHouseNumber: input.address?.houseNumber ?? null,
      buyerPostalCode: input.address?.postalCode ?? null,
      buyerCity: input.address?.city ?? null,
      buyerCountry: input.address?.country ?? null,
    },
  });
}
