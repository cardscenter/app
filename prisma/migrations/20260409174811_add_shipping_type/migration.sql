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
    "shippingType" TEXT NOT NULL DEFAULT 'PARCEL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "isSigned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerShippingMethod_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SellerShippingMethod" ("carrier", "countries", "createdAt", "id", "isActive", "isDefault", "isSigned", "isTracked", "price", "sellerId", "serviceName", "updatedAt") SELECT "carrier", "countries", "createdAt", "id", "isActive", "isDefault", "isSigned", "isTracked", "price", "sellerId", "serviceName", "updatedAt" FROM "SellerShippingMethod";
DROP TABLE "SellerShippingMethod";
ALTER TABLE "new_SellerShippingMethod" RENAME TO "SellerShippingMethod";
CREATE INDEX "SellerShippingMethod_sellerId_idx" ON "SellerShippingMethod"("sellerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
