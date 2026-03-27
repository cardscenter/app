-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT,
    "claimsaleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_claimsaleId_fkey" FOREIGN KEY ("claimsaleId") REFERENCES "Claimsale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("auctionId", "claimsaleId", "createdAt", "id", "updatedAt") SELECT "auctionId", "claimsaleId", "createdAt", "id", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_auctionId_idx" ON "Conversation"("auctionId");
CREATE INDEX "Conversation_claimsaleId_idx" ON "Conversation"("claimsaleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
