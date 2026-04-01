-- AlterTable
ALTER TABLE "Auction" ADD COLUMN "cardItems" TEXT;
ALTER TABLE "Auction" ADD COLUMN "conditionRange" TEXT;
ALTER TABLE "Auction" ADD COLUMN "estimatedCardCount" INTEGER;
ALTER TABLE "Auction" ADD COLUMN "itemCategory" TEXT;
ALTER TABLE "Auction" ADD COLUMN "productType" TEXT;

-- CreateTable
CREATE TABLE "AuctionUpsell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "dailyCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionUpsell_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuctionUpsell_auctionId_idx" ON "AuctionUpsell"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionUpsell_type_expiresAt_idx" ON "AuctionUpsell"("type", "expiresAt");
