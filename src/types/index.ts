export const CARD_CONDITIONS = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const AUCTION_TYPES = [
  "SINGLE_CARD",
  "COLLECTION",
  "BULK",
] as const;
export type AuctionType = (typeof AUCTION_TYPES)[number];

export const AUCTION_STATUSES = [
  "ACTIVE",
  "ENDED_SOLD",
  "ENDED_RESERVE_NOT_MET",
  "ENDED_NO_BIDS",
  "BOUGHT_NOW",
  "CANCELLED",
] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const CLAIMSALE_STATUSES = ["DRAFT", "LIVE", "CLOSED"] as const;
export type ClaimsaleStatus = (typeof CLAIMSALE_STATUSES)[number];

export const CLAIMSALE_ITEM_STATUSES = ["AVAILABLE", "SOLD"] as const;
export type ClaimsaleItemStatus = (typeof CLAIMSALE_ITEM_STATUSES)[number];

export const SHIPPING_BUNDLE_STATUSES = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "COMPLETED",
] as const;
export type ShippingBundleStatus = (typeof SHIPPING_BUNDLE_STATUSES)[number];

export const TRANSACTION_TYPES = [
  "DEPOSIT",
  "PURCHASE",
  "SALE",
  "WITHDRAWAL",
  "FEE",
  "AUCTION_BID",
  "AUCTION_WIN",
  "AUCTION_BID_REFUND",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ACCOUNT_TYPES = ["FREE", "PREMIUM"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Listing types
export const LISTING_TYPES = [
  "SINGLE_CARD",
  "MULTI_CARD",
  "COLLECTION",
  "SEALED_PRODUCT",
  "OTHER",
] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = ["ACTIVE", "SOLD", "EXPIRED", "DELETED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// Delivery & shipping
export const DELIVERY_METHODS = ["PICKUP", "SHIP", "BOTH"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const CARRIERS = ["POSTNL", "DHL", "SELF"] as const;
export type Carrier = (typeof CARRIERS)[number];

export const PACKAGE_SIZES = ["LETTER", "SMALL", "MEDIUM", "LARGE"] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

// Sealed product types
export const SEALED_PRODUCT_TYPES = [
  "BOOSTER",
  "ETB",
  "TIN",
  "BOOSTER_BOX",
  "OTHER_SEALED",
] as const;
export type SealedProductType = (typeof SEALED_PRODUCT_TYPES)[number];

// Upsell types
export const UPSELL_TYPES = [
  "HOMEPAGE_SPOTLIGHT",
  "CATEGORY_HIGHLIGHT",
  "URGENT_LABEL",
] as const;
export type UpsellType = (typeof UPSELL_TYPES)[number];

// Card item entry for MULTI_CARD listings
export interface CardItemEntry {
  cardName: string;
  cardSetId: string;
  condition: string;
  quantity: number;
}

// Account limits
export const ACCOUNT_LIMITS = {
  FREE: {
    maxActiveAuctions: 1,
    maxActiveClaimsales: 1,
    maxItemsPerClaimsale: 20,
  },
  PREMIUM: {
    maxActiveAuctions: Infinity,
    maxActiveClaimsales: Infinity,
    maxItemsPerClaimsale: 100,
  },
} as const;
