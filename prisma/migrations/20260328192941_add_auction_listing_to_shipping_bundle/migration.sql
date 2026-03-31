-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "listingType" TEXT NOT NULL DEFAULT 'SINGLE_CARD',
    "cardName" TEXT,
    "cardSetId" TEXT,
    "condition" TEXT,
    "cardItems" TEXT,
    "estimatedCardCount" INTEGER,
    "conditionRange" TEXT,
    "productType" TEXT,
    "itemCategory" TEXT,
    "pricingType" TEXT NOT NULL,
    "price" REAL,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'SHIP',
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "carriers" TEXT,
    "packageSize" TEXT,
    "packageCount" INTEGER NOT NULL DEFAULT 1,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "buyerId" TEXT,
    CONSTRAINT "Listing_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Listing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("cardItems", "cardName", "cardSetId", "carriers", "condition", "conditionRange", "createdAt", "deliveryMethod", "description", "estimatedCardCount", "expiresAt", "freeShipping", "id", "imageUrls", "itemCategory", "listingType", "packageCount", "packageSize", "price", "pricingType", "productType", "sellerId", "shippingCost", "status", "title", "updatedAt") SELECT "cardItems", "cardName", "cardSetId", "carriers", "condition", "conditionRange", "createdAt", "deliveryMethod", "description", "estimatedCardCount", "expiresAt", "freeShipping", "id", "imageUrls", "itemCategory", "listingType", "packageCount", "packageSize", "price", "pricingType", "productType", "sellerId", "shippingCost", "status", "title", "updatedAt" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
CREATE INDEX "Listing_cardSetId_idx" ON "Listing"("cardSetId");
CREATE INDEX "Listing_listingType_idx" ON "Listing"("listingType");
CREATE TABLE "new_ShippingBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shippingCost" REAL NOT NULL,
    "totalItemCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "shippingMethodId" TEXT,
    "trackingUrl" TEXT,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "buyerStreet" TEXT,
    "buyerHouseNumber" TEXT,
    "buyerPostalCode" TEXT,
    "buyerCity" TEXT,
    "buyerCountry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "auctionId" TEXT,
    "listingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingBundle_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShippingBundle" ("buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt") SELECT "buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt" FROM "ShippingBundle";
DROP TABLE "ShippingBundle";
ALTER TABLE "new_ShippingBundle" RENAME TO "ShippingBundle";
CREATE UNIQUE INDEX "ShippingBundle_auctionId_key" ON "ShippingBundle"("auctionId");
CREATE UNIQUE INDEX "ShippingBundle_listingId_key" ON "ShippingBundle"("listingId");
CREATE INDEX "ShippingBundle_buyerId_idx" ON "ShippingBundle"("buyerId");
CREATE INDEX "ShippingBundle_sellerId_idx" ON "ShippingBundle"("sellerId");
CREATE INDEX "ShippingBundle_buyerId_sellerId_status_idx" ON "ShippingBundle"("buyerId", "sellerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
