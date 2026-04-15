-- CreateTable
CREATE TABLE "CardPriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "priceNormal" REAL,
    "priceReverse" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardPriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardId_idx" ON "CardPriceHistory"("cardId");

-- CreateIndex
CREATE INDEX "CardPriceHistory_date_idx" ON "CardPriceHistory"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CardPriceHistory_cardId_date_key" ON "CardPriceHistory"("cardId", "date");
