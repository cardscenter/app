/*
  Warnings:

  - You are about to drop the column `defaultShippingCost` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Review" ADD COLUMN "communicationRating" INTEGER;
ALTER TABLE "Review" ADD COLUMN "packagingRating" INTEGER;
ALTER TABLE "Review" ADD COLUMN "shippingBundleId" TEXT;
ALTER TABLE "Review" ADD COLUMN "shippingRating" INTEGER;

-- CreateTable
CREATE TABLE "SellerShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "countries" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerShippingMethod_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuctionShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "AuctionShippingMethod_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuctionShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimsaleShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimsaleId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "ClaimsaleShippingMethod_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "ListingShippingMethod_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingShippingMethod_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShippingBundle_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShippingBundle_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "SellerShippingMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShippingBundle" ("buyerId", "createdAt", "id", "sellerId", "shippingCost", "status", "totalCost", "totalItemCost", "updatedAt") SELECT "buyerId", "createdAt", "id", "sellerId", "shippingCost", "status", "totalCost", "totalItemCost", "updatedAt" FROM "ShippingBundle";
DROP TABLE "ShippingBundle";
ALTER TABLE "new_ShippingBundle" RENAME TO "ShippingBundle";
CREATE INDEX "ShippingBundle_buyerId_idx" ON "ShippingBundle"("buyerId");
CREATE INDEX "ShippingBundle_sellerId_idx" ON "ShippingBundle"("sellerId");
CREATE INDEX "ShippingBundle_buyerId_sellerId_status_idx" ON "ShippingBundle"("buyerId", "sellerId", "status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "heldBalance" REAL NOT NULL DEFAULT 0,
    "accountType" TEXT NOT NULL DEFAULT 'FREE',
    "premiumExpiresAt" DATETIME,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountType", "avatarUrl", "balance", "bio", "createdAt", "displayName", "email", "id", "passwordHash", "premiumExpiresAt", "updatedAt") SELECT "accountType", "avatarUrl", "balance", "bio", "createdAt", "displayName", "email", "id", "passwordHash", "premiumExpiresAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SellerShippingMethod_sellerId_idx" ON "SellerShippingMethod"("sellerId");

-- CreateIndex
CREATE INDEX "AuctionShippingMethod_auctionId_idx" ON "AuctionShippingMethod"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionShippingMethod_auctionId_shippingMethodId_key" ON "AuctionShippingMethod"("auctionId", "shippingMethodId");

-- CreateIndex
CREATE INDEX "ClaimsaleShippingMethod_claimsaleId_idx" ON "ClaimsaleShippingMethod"("claimsaleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimsaleShippingMethod_claimsaleId_shippingMethodId_key" ON "ClaimsaleShippingMethod"("claimsaleId", "shippingMethodId");

-- CreateIndex
CREATE INDEX "ListingShippingMethod_listingId_idx" ON "ListingShippingMethod"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingShippingMethod_listingId_shippingMethodId_key" ON "ListingShippingMethod"("listingId", "shippingMethodId");
