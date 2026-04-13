-- Add stable TCGdex card identifier (e.g. "base1-4") to marketplace items.
-- Nullable for backwards-compatibility with existing rows + free-text entries.
ALTER TABLE "Auction" ADD COLUMN "tcgdexId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "tcgdexId" TEXT;
ALTER TABLE "ClaimsaleItem" ADD COLUMN "tcgdexId" TEXT;

CREATE INDEX "Auction_tcgdexId_idx" ON "Auction"("tcgdexId");
CREATE INDEX "Listing_tcgdexId_idx" ON "Listing"("tcgdexId");
CREATE INDEX "ClaimsaleItem_tcgdexId_idx" ON "ClaimsaleItem"("tcgdexId");
