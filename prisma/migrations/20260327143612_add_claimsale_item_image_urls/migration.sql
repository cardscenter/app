/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `ClaimsaleItem` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClaimsaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "cardSetId" TEXT NOT NULL,
    "claimsaleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "buyerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shippingBundleId" TEXT,
    CONSTRAINT "ClaimsaleItem_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClaimsaleItem_shippingBundleId_fkey" FOREIGN KEY ("shippingBundleId") REFERENCES "ShippingBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClaimsaleItem" ("buyerId", "cardName", "cardSetId", "claimsaleId", "condition", "createdAt", "id", "price", "shippingBundleId", "status", "updatedAt") SELECT "buyerId", "cardName", "cardSetId", "claimsaleId", "condition", "createdAt", "id", "price", "shippingBundleId", "status", "updatedAt" FROM "ClaimsaleItem";
DROP TABLE "ClaimsaleItem";
ALTER TABLE "new_ClaimsaleItem" RENAME TO "ClaimsaleItem";
CREATE INDEX "ClaimsaleItem_claimsaleId_idx" ON "ClaimsaleItem"("claimsaleId");
CREATE INDEX "ClaimsaleItem_cardSetId_idx" ON "ClaimsaleItem"("cardSetId");
CREATE INDEX "ClaimsaleItem_buyerId_idx" ON "ClaimsaleItem"("buyerId");
CREATE INDEX "ClaimsaleItem_status_idx" ON "ClaimsaleItem"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
