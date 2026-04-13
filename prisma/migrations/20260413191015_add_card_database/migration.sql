-- Local mirror of TCGdex card data + per-user card-level watchlist.
-- Card.id == TCGdex card id (e.g. "base1-4"), so existing tcgdexId fields on
-- Auction/Listing/ClaimsaleItem join naturally without a mapping table.

CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "rarity" TEXT,
    "hp" INTEGER,
    "types" TEXT,
    "illustrator" TEXT,
    "variants" TEXT,
    "imageUrl" TEXT,
    "priceAvg" REAL,
    "priceLow" REAL,
    "priceTrend" REAL,
    "priceAvg7" REAL,
    "priceAvg30" REAL,
    "priceUpdatedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Card_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Card_cardSetId_idx" ON "Card"("cardSetId");
CREATE INDEX "Card_name_idx" ON "Card"("name");
CREATE INDEX "Card_priceUpdatedAt_idx" ON "Card"("priceUpdatedAt");
CREATE INDEX "Card_lastViewedAt_idx" ON "Card"("lastViewedAt");

CREATE TABLE "CardWatchlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CardWatchlist_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CardWatchlist_userId_cardId_key" ON "CardWatchlist"("userId", "cardId");
CREATE INDEX "CardWatchlist_userId_idx" ON "CardWatchlist"("userId");
CREATE INDEX "CardWatchlist_cardId_idx" ON "CardWatchlist"("cardId");
