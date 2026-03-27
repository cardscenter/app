-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "relatedListingId" TEXT;

-- CreateTable
CREATE TABLE "ListingUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingUpsell_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "Listing_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("cardName", "cardSetId", "condition", "createdAt", "description", "expiresAt", "id", "imageUrls", "price", "pricingType", "sellerId", "shippingCost", "status", "title", "updatedAt") SELECT "cardName", "cardSetId", "condition", "createdAt", "description", "expiresAt", "id", "imageUrls", "price", "pricingType", "sellerId", "shippingCost", "status", "title", "updatedAt" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
CREATE INDEX "Listing_cardSetId_idx" ON "Listing"("cardSetId");
CREATE INDEX "Listing_listingType_idx" ON "Listing"("listingType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ListingUpsell_listingId_idx" ON "ListingUpsell"("listingId");

-- CreateIndex
CREATE INDEX "ListingUpsell_type_expiresAt_idx" ON "ListingUpsell"("type", "expiresAt");
