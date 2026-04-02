-- Add orderNumber to ShippingBundle
-- Note: The column was added and backfilled via scripts/backfill-order-numbers.ts
-- This migration file documents the schema change for migration history consistency.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShippingBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_ShippingBundle" ("auctionId", "buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "listingId", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt") SELECT "auctionId", "buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "listingId", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt" FROM "ShippingBundle";
DROP TABLE "ShippingBundle";
ALTER TABLE "new_ShippingBundle" RENAME TO "ShippingBundle";
CREATE UNIQUE INDEX "ShippingBundle_orderNumber_key" ON "ShippingBundle"("orderNumber");
CREATE UNIQUE INDEX "ShippingBundle_auctionId_key" ON "ShippingBundle"("auctionId");
CREATE UNIQUE INDEX "ShippingBundle_listingId_key" ON "ShippingBundle"("listingId");
CREATE INDEX "ShippingBundle_buyerId_idx" ON "ShippingBundle"("buyerId");
CREATE INDEX "ShippingBundle_sellerId_idx" ON "ShippingBundle"("sellerId");
CREATE INDEX "ShippingBundle_buyerId_sellerId_status_idx" ON "ShippingBundle"("buyerId", "sellerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
