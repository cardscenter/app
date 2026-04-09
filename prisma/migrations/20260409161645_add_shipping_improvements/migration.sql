-- AlterTable
ALTER TABLE "ClaimsaleItem" ADD COLUMN "refundedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SellerShippingMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "countries" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerShippingMethod_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SellerShippingMethod" ("carrier", "countries", "createdAt", "id", "isActive", "price", "sellerId", "serviceName", "updatedAt") SELECT "carrier", "countries", "createdAt", "id", "isActive", "price", "sellerId", "serviceName", "updatedAt" FROM "SellerShippingMethod";
DROP TABLE "SellerShippingMethod";
ALTER TABLE "new_SellerShippingMethod" RENAME TO "SellerShippingMethod";
CREATE INDEX "SellerShippingMethod_sellerId_idx" ON "SellerShippingMethod"("sellerId");
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
    "refundedAmount" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_ShippingBundle" ("auctionId", "buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "listingId", "orderNumber", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt") SELECT "auctionId", "buyerCity", "buyerCountry", "buyerHouseNumber", "buyerId", "buyerPostalCode", "buyerStreet", "createdAt", "deliveredAt", "id", "listingId", "orderNumber", "sellerId", "shippedAt", "shippingCost", "shippingMethodId", "status", "totalCost", "totalItemCost", "trackingUrl", "updatedAt" FROM "ShippingBundle";
DROP TABLE "ShippingBundle";
ALTER TABLE "new_ShippingBundle" RENAME TO "ShippingBundle";
CREATE UNIQUE INDEX "ShippingBundle_orderNumber_key" ON "ShippingBundle"("orderNumber");
CREATE UNIQUE INDEX "ShippingBundle_auctionId_key" ON "ShippingBundle"("auctionId");
CREATE UNIQUE INDEX "ShippingBundle_listingId_key" ON "ShippingBundle"("listingId");
CREATE INDEX "ShippingBundle_buyerId_idx" ON "ShippingBundle"("buyerId");
CREATE INDEX "ShippingBundle_sellerId_idx" ON "ShippingBundle"("sellerId");
CREATE INDEX "ShippingBundle_buyerId_sellerId_status_idx" ON "ShippingBundle"("buyerId", "sellerId", "status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "profileBanner" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "heldBalance" REAL NOT NULL DEFAULT 0,
    "reservedBalance" REAL NOT NULL DEFAULT 0,
    "bankTransferReference" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NONE',
    "accountType" TEXT NOT NULL DEFAULT 'FREE',
    "premiumExpiresAt" DATETIME,
    "accountKind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "vatNumber" TEXT,
    "cocNumber" TEXT,
    "street" TEXT,
    "houseNumber" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "sellingCountries" TEXT NOT NULL DEFAULT 'ALL_EU',
    "accountFocus" TEXT,
    "referralSource" TEXT,
    "termsAcceptedAt" DATETIME,
    "lastUsernameChange" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "referralSource", "reservedBalance", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus") SELECT "accountFocus", "accountKind", "accountType", "avatarUrl", "balance", "bankTransferReference", "bio", "city", "cocNumber", "companyName", "country", "createdAt", "displayName", "email", "firstName", "heldBalance", "houseNumber", "id", "isVerified", "lastName", "lastUsernameChange", "passwordHash", "postalCode", "premiumExpiresAt", "referralSource", "reservedBalance", "street", "termsAcceptedAt", "updatedAt", "vatNumber", "verificationStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");
CREATE UNIQUE INDEX "User_bankTransferReference_key" ON "User"("bankTransferReference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
